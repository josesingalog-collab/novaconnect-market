/**
 * Ventes du vendeur — requêtes côté serveur.
 *
 * Le revenu vendeur est calculé exclusivement à partir de
 * order_items.vendor_amount, jamais orders.total.
 *
 * Le vendorId est injecté par l'action serveur (jamais par le client).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { decimalStringToMinor, addMinors, minorToDecimalString } from "@/lib/money";

export type SalesDb = Pick<SupabaseClient, "from">;

export interface OrderItemRow {
  readonly id: string;
  readonly vendor_id: string;
  readonly vendor_amount: string;
  readonly currency: string;
  readonly order: {
    readonly id: string;
    readonly order_number: string;
    readonly status: string;
    readonly created_at: string;
    readonly currency: string;
  } | null;
}

export interface CurrencyRevenue {
  readonly currency: string;
  readonly totalRevenue: string;
  readonly totalSales: number;
}

export interface SaleOrder {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: string;
  readonly vendorAmount: string;
  readonly currency: string;
  readonly createdAt: string;
  readonly productCount: number;
}

export interface SalesSummary {
  readonly totalSales: number;
  readonly revenuesByCurrency: CurrencyRevenue[];
  readonly recentOrders: SaleOrder[];
}

/**
 * Récupère les IDs de commandes du vendeur via order_items.vendor_id.
 */
async function getOrderIdsByVendor(db: SalesDb, vendorId: string): Promise<string[]> {
  const { data, error } = await db.from("order_items").select("order_id").eq("vendor_id", vendorId);

  if (error !== null) {
    throw new Error(`Lecture des items de commande impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => row.order_id as string);
}

/**
 * Récupère les ventes du vendeur connecté via order_items.vendor_id.
 * Retourne les commandes avec le montant vendeur (vendor_amount) par commande.
 */
export async function listSales(db: SalesDb, vendorId: string, limit = 5): Promise<SaleOrder[]> {
  const orderIds = await getOrderIdsByVendor(db, vendorId);

  if (orderIds.length === 0) {
    return [];
  }

  const { data, error } = await db
    .from("order_items")
    .select(
      `
      id, vendor_amount, currency,
      order:orders(id, order_number, status, created_at, currency)
    `,
    )
    .eq("vendor_id", vendorId)
    .in("order_id", orderIds);

  if (error !== null) {
    throw new Error(`Lecture des ventes impossible : ${error.message}`);
  }

  const items = data ?? [];

  const orderMap = new Map<
    string,
    { vendorAmountMinor: bigint; currency: string; count: number }
  >();
  for (const item of items) {
    const orderRows = Array.isArray(item.order) ? item.order : [item.order].filter(Boolean);
    const order = orderRows[0] as
      | { id: string; order_number: string; status: string; created_at: string; currency: string }
      | undefined;
    if (!order) continue;

    const key = order.id;
    const existing = orderMap.get(key);
    const itemMinor = decimalStringToMinor(
      item.vendor_amount as string,
      item.currency as "USD" | "CDF",
    );

    if (existing) {
      existing.vendorAmountMinor = addMinors(existing.vendorAmountMinor, itemMinor);
      existing.count += 1;
    } else {
      orderMap.set(key, {
        vendorAmountMinor: itemMinor,
        currency: order.currency,
        count: 1,
      });
    }
  }

  const result: SaleOrder[] = [];
  orderMap.forEach((value, orderId) => {
    const firstItem = items.find((i) => {
      const rows = Array.isArray(i.order) ? i.order : [i.order].filter(Boolean);
      return (rows[0] as { id: string })?.id === orderId;
    });
    const orderRows = firstItem
      ? Array.isArray(firstItem.order)
        ? firstItem.order
        : [firstItem.order].filter(Boolean)
      : [];
    const order = (orderRows[0] as {
      id: string;
      order_number: string;
      status: string;
      created_at: string;
      currency: string;
    }) ?? { id: orderId, order_number: "", status: "", created_at: "", currency: "" };
    result.push({
      id: orderId,
      orderNumber: order.order_number,
      status: order.status,
      vendorAmount: minorToDecimalString(value.vendorAmountMinor, value.currency as "USD" | "CDF"),
      currency: value.currency,
      createdAt: order.created_at,
      productCount: value.count,
    });
  });

  result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return result.slice(0, limit);
}

/**
 * Récupère le résumé des ventes du vendeur.
 * Retourne le revenu par devise basé sur order_items.vendor_amount (jamais orders.total).
 * Seules les commandes PAID sont incluses dans le revenu.
 */
export async function getSalesSummary(db: SalesDb, vendorId: string): Promise<SalesSummary> {
  const orderIds = await getOrderIdsByVendor(db, vendorId);

  if (orderIds.length === 0) {
    return { totalSales: 0, revenuesByCurrency: [], recentOrders: [] };
  }

  const { data, error } = await db
    .from("order_items")
    .select(
      `
      id, vendor_amount, currency,
      order:orders(id, order_number, status, created_at, currency)
    `,
    )
    .eq("vendor_id", vendorId)
    .in("order_id", orderIds);

  if (error !== null) {
    throw new Error(`Lecture du résumé des ventes impossible : ${error.message}`);
  }

  const items = data ?? [];

  const currencyMap = new Map<string, { revenueMinor: bigint; paidOrderIds: Set<string> }>();
  const paidOrderMap = new Map<
    string,
    {
      order: {
        order_number: string;
        status: string;
        created_at: string;
        currency: string;
        id: string;
      };
      vendorAmountMinor: bigint;
    }
  >();

  for (const item of items) {
    const orderRows = Array.isArray(item.order) ? item.order : [item.order].filter(Boolean);
    const order = orderRows[0] as
      | { id: string; order_number: string; status: string; created_at: string; currency: string }
      | undefined;
    if (!order) continue;

    const itemMinor = decimalStringToMinor(
      item.vendor_amount as string,
      item.currency as "USD" | "CDF",
    );
    const isPaid = order.status === "PAID";

    const existingOrder = paidOrderMap.get(order.id);
    if (existingOrder) {
      paidOrderMap.set(order.id, {
        order,
        vendorAmountMinor: addMinors(existingOrder.vendorAmountMinor, itemMinor),
      });
    } else {
      paidOrderMap.set(order.id, { order, vendorAmountMinor: itemMinor });
    }

    if (isPaid) {
      const existing = currencyMap.get(order.currency);
      if (existing) {
        existing.revenueMinor = addMinors(existing.revenueMinor, itemMinor);
        existing.paidOrderIds.add(order.id);
      } else {
        currencyMap.set(order.currency, {
          revenueMinor: itemMinor,
          paidOrderIds: new Set([order.id]),
        });
      }
    }
  }

  const revenuesByCurrency: CurrencyRevenue[] = [];
  currencyMap.forEach((value, currency) => {
    revenuesByCurrency.push({
      currency,
      totalRevenue: minorToDecimalString(value.revenueMinor, currency as "USD" | "CDF"),
      totalSales: value.paidOrderIds.size,
    });
  });

  revenuesByCurrency.sort((a, b) => {
    if (a.currency === "USD") return -1;
    if (b.currency === "USD") return 1;
    return a.currency.localeCompare(b.currency);
  });

  const allOrderMap = new Map<
    string,
    {
      order: {
        order_number: string;
        status: string;
        created_at: string;
        currency: string;
        id: string;
      };
      vendorAmountMinor: bigint;
      productCount: number;
    }
  >();
  for (const item of items) {
    const orderRows = Array.isArray(item.order) ? item.order : [item.order].filter(Boolean);
    const order = orderRows[0] as
      | { id: string; order_number: string; status: string; created_at: string; currency: string }
      | undefined;
    if (!order) continue;
    const itemMinor = decimalStringToMinor(
      item.vendor_amount as string,
      item.currency as "USD" | "CDF",
    );
    const existing = allOrderMap.get(order.id);
    if (existing) {
      allOrderMap.set(order.id, {
        order,
        vendorAmountMinor: addMinors(existing.vendorAmountMinor, itemMinor),
        productCount: existing.productCount + 1,
      });
    } else {
      allOrderMap.set(order.id, { order, vendorAmountMinor: itemMinor, productCount: 1 });
    }
  }

  const recentOrders: SaleOrder[] = [];
  allOrderMap.forEach((value, orderId) => {
    recentOrders.push({
      id: orderId,
      orderNumber: value.order.order_number,
      status: value.order.status,
      vendorAmount: minorToDecimalString(
        value.vendorAmountMinor,
        value.order.currency as "USD" | "CDF",
      ),
      currency: value.order.currency,
      createdAt: value.order.created_at,
      productCount: value.productCount,
    });
  });

  recentOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const totalSales = revenuesByCurrency.reduce((sum, r) => sum + r.totalSales, 0);

  return {
    totalSales,
    revenuesByCurrency,
    recentOrders: recentOrders.slice(0, 5),
  };
}
