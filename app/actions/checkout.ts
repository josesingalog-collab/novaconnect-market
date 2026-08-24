"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createCheckoutOrder, type CheckoutOrder } from "@/services/orders/checkout";
import { checkoutSchema } from "@/schemas/checkout";

export interface CheckoutFormState {
  status: "idle" | "error" | "success";
  error: string | null;
  /** Rempli uniquement quand status === "success" (montants serveur). */
  order: CheckoutOrder | null;
}

export const initialCheckoutState: CheckoutFormState = {
  status: "idle",
  error: null,
  order: null,
};

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
