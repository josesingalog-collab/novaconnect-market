/**
 * Webhook de paiement — SEUL point d'entrée d'écriture du statut PAID
 * (invariant 4, §49/§50). Chaîne : signature HMAC → journal idempotent
 * `payment_events` → résolution du paiement → RPC `confirm_order_payment`
 * (migration 0007, non modifiée).
 *
 * Codes : 200 ok (ou rejeu déjà journalisé) · 400 payload invalide ·
 * 401 signature absente/invalide · 404 paiement introuvable ·
 * 409 statut non confirmable · 500 configuration manquante.
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canSimulatePayments, getPaymentWebhookSecret } from "@/lib/env";
import {
  PAYMENT_SIGNATURE_HEADER,
  deriveEventHash,
  verifyPaymentSignature,
} from "@/lib/payments/signature";

export const runtime = "nodejs";

const payloadSchema = z.object({
  payment_id: z.uuid().optional(),
  provider_reference: z.string().min(1).optional(),
  provider: z.string().min(1).default("mock"),
  event_type: z.string().min(1).default("payment.confirmed"),
});

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

/** Messages levés par confirm_order_payment → code HTTP. */
function rpcStatus(message: string): number {
  if (/paiement introuvable|commande introuvable/i.test(message)) return 404;
  if (/non confirmable|non en attente/i.test(message)) return 409;
  return 500;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  const secret = getPaymentWebhookSecret();
  if (secret === null) {
    return json(500, { error: "PAYMENT_WEBHOOK_SECRET non configuré" });
  }

  if (!verifyPaymentSignature(rawBody, secret, request.headers.get(PAYMENT_SIGNATURE_HEADER))) {
    return json(401, { error: "Signature webhook invalide" });
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody) as unknown;
  } catch {
    return json(400, { error: "Corps JSON invalide" });
  }
  const parsed = payloadSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return json(400, { error: "Payload webhook invalide" });
  }
  const payload = parsed.data;

  // Le seul provider V1 est volontairement réservé aux environnements hors production.
  if (!canSimulatePayments()) {
    return json(503, { error: "Les webhooks mock sont désactivés en production" });
  }
  if (payload.event_type !== "payment.confirmed") {
    return json(400, { error: "Type d'événement de paiement non pris en charge" });
  }

  if (payload.payment_id === undefined && payload.provider_reference === undefined) {
    return json(400, { error: "payment_id ou provider_reference requis" });
  }

  const db = createSupabaseAdminClient();

  // Résolution du paiement (id direct, sinon référence fournisseur + provider).
  let paymentId: string | null = null;
  if (payload.payment_id !== undefined) {
    const { data } = await db
      .from("payments")
      .select("id")
      .eq("id", payload.payment_id)
      .maybeSingle();
    paymentId = data?.id ?? null;
  } else if (payload.provider_reference !== undefined) {
    const { data } = await db
      .from("payments")
      .select("id")
      .eq("provider", payload.provider)
      .eq("provider_reference", payload.provider_reference)
      .maybeSingle();
    paymentId = data?.id ?? null;
  }

  // Journal brut — UNIQUE(provider, event_hash). Un hash déjà vu ⇒ rejeu :
  // on accuse réception SANS rejouer la confirmation.
  const eventHash = deriveEventHash(rawBody);
  const { error: eventError } = await db.from("payment_events").insert({
    payment_id: paymentId,
    provider: payload.provider,
    event_type: payload.event_type,
    event_hash: eventHash,
    payload: (parsedJson as Record<string, unknown>) ?? {},
  });
  if (eventError !== null && eventError.code === "23505") {
    return json(200, { ok: true, replay: true });
  }
  if (eventError !== null) {
    return json(500, { error: "Journalisation impossible" });
  }

  if (paymentId === null) {
    return json(404, { error: "Paiement introuvable" });
  }

  const { error: confirmError } = await db.rpc("confirm_order_payment", {
    p_payment_id: paymentId,
  });
  if (confirmError !== null) {
    return json(rpcStatus(confirmError.message), { error: "Confirmation refusée" });
  }

  return json(200, { ok: true });
}
