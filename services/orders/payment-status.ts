/**
 * Statut de commande côté acheteur — lecture RLS (l'acheteur ne voit que SES
 * commandes). Utilisé par le polling de l'écran de confirmation : le statut
 * fait foi dans PostgreSQL, jamais dans un état local client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface OrdersDb {
  from: SupabaseClient["from"];
}

export type OrderStatusRow = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED";

/**
 * Statut actuel de la commande si elle appartient à l'appelant, sinon null
 * (RLS filtre la ligne → réponse identique à une commande inexistante :
 * pas d'énumération d'ids).
 */
export async function getOwnOrderStatus(
  db: OrdersDb,
  orderId: string,
): Promise<OrderStatusRow | null> {
  const { data } = await db.from("orders").select("status").eq("id", orderId).maybeSingle();
  const value = data?.status;
  if (
    value === "PENDING" ||
    value === "PAID" ||
    value === "FAILED" ||
    value === "CANCELLED" ||
    value === "REFUNDED"
  ) {
    return value;
  }
  return null;
}
