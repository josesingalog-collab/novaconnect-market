"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { canSimulatePayments } from "@/lib/env";
import { createCheckoutOrder } from "@/services/orders/checkout";
import { getOwnOrderStatus, type OrderStatusRow } from "@/services/orders/payment-status";
import { checkoutSchema } from "@/schemas/checkout";
import type { CheckoutFormState } from "@/lib/checkout-form-state";

/**
 * Crée la commande depuis le panier du client.
 *
 * Le payload ne contient QUE les ids produits + l'acceptation des CGU :
 * authentification et profil ACTIVE vérifiés ici ET dans la RPC ; tous les
 * montants sont calculés par PostgreSQL. Aucune écriture directe du client
 * sur orders/order_items/payments (aucune policy d'écriture).
 */
export async function placeOrderAction(
  _prevState: CheckoutFormState,
  formData: FormData,
): Promise<CheckoutFormState> {
  if (!canSimulatePayments()) {
    return {
      status: "error",
      error: "Les paiements ne sont pas encore disponibles.",
      order: null,
    };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/checkout");
  }
  if (current.kind === "missing-profile") {
    return {
      status: "error",
      error: "Profil introuvable. Déconnecte-toi puis reconnecte-toi.",
      order: null,
    };
  }

  const parsed = checkoutSchema.safeParse({
    productIds: parseProductIds(formData),
  });
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Panier invalide.",
      order: null,
    };
  }

  if (formData.get("cgu") !== "on") {
    return {
      status: "error",
      error: "Tu dois accepter les conditions générales pour commander.",
      order: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const result = await createCheckoutOrder(supabase, parsed.data.productIds);

  if (!result.ok) {
    return { status: "error", error: result.error, order: null };
  }

  return { status: "success", error: null, order: result.order };
}

function parseProductIds(formData: FormData): string[] {
  const raw = formData.get("productIds");
  if (typeof raw !== "string" || raw.length === 0) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Paiement simulé (V1, provider "mock") — D-026.
//
// Le contrat validé : la simulation appelle DIRECTEMENT la RPC
// `confirm_order_payment` côté serveur, sans passer par le webhook HTTP signé
// (réservé aux vraies notifications fournisseur et aux tests curl).
//
// Sécurité : ownership vérifié via une lecture RLS de la commande AVANT tout
// usage du client service_role — celui-ci n'est employé que pour lire la
// ligne `payments` (table sans policy par conception) puis exécuter la RPC,
// exactement comme le ferait le webhook. Aucun montant ni statut ne vient du
// client : seuls l'id de commande et l'intention transitent.
// ---------------------------------------------------------------------------

export type MockPaymentResult =
  | { readonly ok: true; readonly orderStatus: OrderStatusRow }
  | { readonly ok: false; readonly error: string };

export async function mockConfirmPaymentAction(orderId: string): Promise<MockPaymentResult> {
  if (!canSimulatePayments()) {
    return { ok: false, error: "Le paiement simulé est désactivé en production." };
  }

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return { ok: false, error: "Commande invalide." };
  }

  const current = await getCurrentProfile();
  if (current.kind !== "ok") {
    return { ok: false, error: "Session expirée. Reconnecte-toi." };
  }

  // Ownership + statut via RLS (null si commande d'autrui ou inexistante).
  const supabase = await createSupabaseServerClient();
  const orderStatus = await getOwnOrderStatus(supabase, orderId);
  if (orderStatus === null) {
    return { ok: false, error: "Commande introuvable." };
  }
  if (orderStatus === "PAID") {
    return { ok: true, orderStatus: "PAID" }; // idempotent côté UX
  }
  if (orderStatus !== "PENDING") {
    return { ok: false, error: `Commande non payable (statut : ${orderStatus}).` };
  }

  const admin = createSupabaseAdminClient();
  const { data: payment } = await admin
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .eq("status", "PENDING")
    .limit(1)
    .maybeSingle();

  if (payment === null) {
    return {
      ok: false,
      error: "Aucun paiement en attente pour cette commande.",
    };
  }

  const { error } = await admin.rpc("confirm_order_payment", {
    p_payment_id: payment.id,
  });
  if (error !== null) {
    return {
      ok: false,
      error: /non confirmable|non en attente/i.test(error.message)
        ? "Ce paiement n'est plus confirmable."
        : "La confirmation a échoué. Réessaie dans un instant.",
    };
  }

  revalidatePath("/dashboard/commandes");
  return { ok: true, orderStatus: "PAID" };
}

/** Polling de l'écran de confirmation — lecture RLS du statut, aucun secret. */
export async function getMyOrderStatusAction(
  orderId: string,
): Promise<{ status: OrderStatusRow | null }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId)) {
    return { status: null };
  }
  const supabase = await createSupabaseServerClient();
  return { status: await getOwnOrderStatus(supabase, orderId) };
}
