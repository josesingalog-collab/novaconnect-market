/**
 * Checkout — appel typé de la RPC `create_checkout_order` (migration 0011, S3).
 *
 * Contrat de sécurité :
 *  - l'appelant (action serveur) garantit une session valide et un profil
 *    ACTIVE ; la RPC le re-vérifie elle-même via auth.uid() (défense en
 *    profondeur) ;
 *  - AUCUN montant ne vient du client : PostgreSQL relit les produits publiés,
 *    les vendeurs actifs et les taux de commission, calcule tout en numeric
 *    exact puis renvoie la commande pricée ;
 *  - les montants sérialisés dans le JSON sont des TEXT au format decimal
 *    canonique (D-001) — jamais de nombre JSON (D-016).
 *
 * Le client Supabase est injecté (`rpc`) : pages serveur → client à session
 * cookie ; tests d'intégration → client anon avec session.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type CheckoutDb = Pick<SupabaseClient, "rpc">;

export interface CheckoutOrderItem {
  readonly productId: string;
  readonly vendorId: string;
  readonly storeName: string;
  readonly productTitle: string;
  /** Montants en decimal string calculés par PostgreSQL. */
  readonly unitPrice: string;
  readonly quantity: number;
  readonly lineTotal: string;
  readonly commissionRateBps: number;
  readonly commissionAmount: string;
  readonly vendorAmount: string;
  readonly currency: string;
}

export interface CheckoutOrder {
  readonly orderId: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly currency: string;
  readonly subtotal: string;
  readonly discount: string;
  readonly platformFee: string;
  readonly total: string;
  readonly items: readonly CheckoutOrderItem[];
}

export type CheckoutResult =
  | { readonly ok: true; readonly order: CheckoutOrder }
  | { readonly ok: false; readonly error: string };

interface RawCheckoutItem {
  product_id: string;
  vendor_id: string;
  store_name: string;
  product_title: string;
  unit_price: string;
  quantity: number;
  line_total: string;
  commission_rate_bps: number;
  commission_amount: string;
  vendor_amount: string;
  currency: string;
}

interface RawCheckoutOrder {
  order_id: string;
  order_number: string;
  status: string;
  currency: string;
  subtotal: string;
  discount: string;
  platform_fee: string;
  total: string;
  items: RawCheckoutItem[];
}

function isRawOrder(value: unknown): value is RawCheckoutOrder {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v["order_id"] === "string" &&
    typeof v["order_number"] === "string" &&
    typeof v["status"] === "string" &&
    typeof v["currency"] === "string" &&
    Array.isArray(v["items"])
  );
}

function friendlyCheckoutError(message: string): string {
  if (/panier vide/i.test(message)) return "Ton panier est vide.";
  if (/introuvable|non publie|non disponible/i.test(message)) {
    return "Un produit du panier n'est plus disponible. Actualise ta page.";
  }
  if (/devise/i.test(message)) return "Le panier contient des devises incompatibles.";
  if (/suspendu|boutique/i.test(message)) {
    return "Une boutique concernée n'accepte pas de commandes actuellement.";
  }
  if (/profil|compte/i.test(message)) {
    return "Ton compte ne permet pas de passer commande. Reconnecte-toi.";
  }
  if (/failed to fetch|network/i.test(message)) {
    return "Connexion au serveur impossible. Réessaie dans un instant.";
  }
  return "La commande n'a pas pu être créée. Réessaie dans un instant.";
}

/**
 * Crée la commande PENDING (order + items snapshot + paiement PENDING) en une
 * transaction SQL atomique. Le retour est validé structurellement avant usage.
 */
export async function createCheckoutOrder(
  db: CheckoutDb,
  productIds: readonly string[],
): Promise<CheckoutResult> {
  const deduped = [...new Set(productIds)];

  const { data, error } = await db.rpc("create_checkout_order", {
    p_product_ids: deduped,
  });

  if (error !== null) {
    return { ok: false, error: friendlyCheckoutError(error.message) };
  }
  if (!isRawOrder(data)) {
    return { ok: false, error: "Réponse serveur inattendue. Réessaie dans un instant." };
  }

  return {
    ok: true,
    order: {
      orderId: data.order_id,
      orderNumber: data.order_number,
      status: data.status,
      currency: data.currency,
      subtotal: String(data.subtotal),
      discount: String(data.discount),
      platformFee: String(data.platform_fee),
      total: String(data.total),
      items: data.items.map((item) => ({
        productId: item.product_id,
        vendorId: item.vendor_id,
        storeName: item.store_name,
        productTitle: item.product_title,
        unitPrice: String(item.unit_price),
        quantity: item.quantity,
        lineTotal: String(item.line_total),
        commissionRateBps: item.commission_rate_bps,
        commissionAmount: String(item.commission_amount),
        vendorAmount: String(item.vendor_amount),
        currency: item.currency,
      })),
    },
  };
}
