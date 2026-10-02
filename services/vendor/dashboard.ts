/**
 * Agrégateur du dashboard vendeur.
 *
 * Récupère en une seule passe :
 * 1. Boutique du vendeur
 * 2. Produits du vendeur
 * 3. Ventes du vendeur
 * 4. Balances financiers du vendeur
 *
 * Le vendorId est injecté côté serveur (jamais par le client).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { listMyProducts, type SellerProduct } from "@/services/products/manage";
import { getSalesSummary, type SaleOrder, type SalesSummary } from "./sales";

export type DashboardDb = SupabaseClient;

export interface VendorDashboardData {
  readonly shop: {
    readonly id: string;
    readonly storeName: string;
    readonly slug: string;
    readonly description: string | null;
    readonly status: string;
    readonly logoUrl: string | null;
    readonly createdAt: string;
  } | null;
  readonly products: {
    readonly total: number;
    readonly drafts: number;
    readonly pendingReview: number;
    readonly published: number;
    readonly rejected: number;
    readonly archived: number;
    readonly items: SellerProduct[];
  };
  readonly sales: {
    readonly totalSales: number;
    readonly revenuesByCurrency: Array<{
      readonly currency: string;
      readonly totalRevenue: string;
      readonly totalSales: number;
    }>;
    readonly recentOrders: SaleOrder[];
  };
  readonly balances:
    | {
        readonly currency: string;
        readonly accountingBalance: string;
        readonly reservedAmount: string;
        readonly availableBalance: string;
      }[]
    | null;
}

/**
 * Récupère les soldes du vendeur via la RPC existante.
 * Réutilise la fonction get_my_vendor_balances() de PostgreSQL.
 */
async function getVendorBalances(db: DashboardDb): Promise<
  | {
      currency: string;
      accountingBalance: string;
      reservedAmount: string;
      availableBalance: string;
    }[]
  | null
> {
  try {
    const { data, error } = await db.rpc("get_my_vendor_balances");
    if (error !== null) {
      return null;
    }
    return (data ?? []).map(
      (row: {
        currency: string;
        accounting_balance: string;
        reserved_amount: string;
        available_balance: string;
      }) => ({
        currency: row.currency,
        accountingBalance: String(row.accounting_balance),
        reservedAmount: String(row.reserved_amount),
        availableBalance: String(row.available_balance),
      }),
    );
  } catch {
    return null;
  }
}

/**
 * Agrège toutes les données du dashboard vendeur.
 * Les requêtes produits, ventes et balances s'exécutent en parallèle.
 */
export async function getVendorDashboard(): Promise<VendorDashboardData> {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    throw new Error("Non authentifié");
  }

  if (current.kind === "missing-profile") {
    throw new Error("Profil introuvable");
  }

  const supabase = await createSupabaseServerClient();
  const profileId = current.profile.id;

  // Récupérer la boutique
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, store_name, slug, description, logo_url, status, created_at")
    .eq("user_id", profileId)
    .maybeSingle();

  const vendorId = vendor?.id ?? null;

  const productsPromise = vendorId
    ? listMyProducts(supabase, vendorId)
    : Promise.resolve<SellerProduct[]>([]);
  const salesPromise = vendorId
    ? getSalesSummary(supabase, vendorId)
    : Promise.resolve<SalesSummary>({ totalSales: 0, revenuesByCurrency: [], recentOrders: [] });
  const balancesPromise = vendorId
    ? getVendorBalances(supabase)
    : Promise.resolve<VendorDashboardData["balances"]>(null);

  const [products, sales, balances] = await Promise.all([
    productsPromise,
    salesPromise,
    balancesPromise,
  ]);

  const stats = {
    total: products.length,
    drafts: products.filter((p) => p.status === "DRAFT").length,
    pendingReview: products.filter((p) => p.status === "PENDING_REVIEW").length,
    published: products.filter((p) => p.status === "PUBLISHED").length,
    rejected: products.filter((p) => p.status === "REJECTED").length,
    archived: products.filter((p) => p.status === "ARCHIVED").length,
  };

  return {
    shop: vendor
      ? {
          id: vendor.id,
          storeName: vendor.store_name,
          slug: vendor.slug,
          description: vendor.description,
          status: vendor.status,
          logoUrl: vendor.logo_url,
          createdAt: vendor.created_at,
        }
      : null,
    products: {
      ...stats,
      items: products,
    },
    sales,
    balances,
  };
}
