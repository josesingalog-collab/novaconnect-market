import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getSalesSummary, listSales } from "@/services/vendor/sales";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMinorAmount, decimalStringToMinor } from "@/lib/money";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes ventes — NovaConnect Market",
  robots: { index: false, follow: false },
};

const ORDER_STATUS_LABELS: Record<
  string,
  { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }
> = {
  PENDING: { label: "En attente", variant: "warning" },
  PAID: { label: "Payée", variant: "success" },
  CANCELLED: { label: "Annulée", variant: "destructive" },
  REFUNDED: { label: "Remboursée", variant: "outline" },
  FAILED: { label: "Échouée", variant: "destructive" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function getVendorId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const current = await getCurrentProfile();

  if (current.kind !== "ok") return null;

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .maybeSingle();

  return vendor?.id ?? null;
}

export default async function VentesPage() {
  const vendorId = await getVendorId();

  const supabase = await createSupabaseServerClient();

  const summary = vendorId
    ? await getSalesSummary(supabase, vendorId)
    : { totalSales: 0, revenuesByCurrency: [], recentOrders: [] };
  const orders = vendorId ? await listSales(supabase, vendorId, 10) : [];

  const usdRevenue = summary.revenuesByCurrency.find((r) => r.currency === "USD");
  const cdfRevenue = summary.revenuesByCurrency.find((r) => r.currency === "CDF");

  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div>
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          NovaConnect Market
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Mes ventes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Suivez vos commandes et vos revenus.</p>
      </div>

      <section aria-label="Statistiques">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard
            label="Nombre de ventes"
            value={summary.totalSales}
            description="Commandes payées"
          />
          <StatCard
            label="Revenus USD"
            value={
              usdRevenue
                ? formatMinorAmount(decimalStringToMinor(usdRevenue.totalRevenue, "USD"), "USD")
                : "$0.00"
            }
            description={`${usdRevenue?.totalSales ?? 0} vente${(usdRevenue?.totalSales ?? 0) !== 1 ? "s" : ""}`}
          />
          <StatCard
            label="Revenus CDF"
            value={
              cdfRevenue
                ? formatMinorAmount(decimalStringToMinor(cdfRevenue.totalRevenue, "CDF"), "CDF")
                : "0.00 FC"
            }
            description={`${cdfRevenue?.totalSales ?? 0} vente${(cdfRevenue?.totalSales ?? 0) !== 1 ? "s" : ""}`}
          />
        </div>
      </section>

      <section aria-label="Commandes">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Commandes récentes
          </h2>
          <Link
            href="/vendor/catalogue"
            className="text-sm font-medium text-primary hover:underline"
          >
            Voir le catalogue →
          </Link>
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
                aria-hidden="true"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </span>
            }
            title="Toutes vos ventes apparaîtront ici"
            description="Après votre première commande, elle apparaîtra dans cette section avec son statut et ses revenus."
            action={{ label: "Voir le catalogue", href: "/vendor/catalogue" }}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {orders.map((order) => {
              const statusBadge = ORDER_STATUS_LABELS[order.status] ?? {
                label: order.status,
                variant: "secondary" as const,
              };
              return (
                <Card key={order.id} variant="bordered">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{order.orderNumber}</p>
                        <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatDate(order.createdAt)}</span>
                        <span>
                          {order.productCount} produit{order.productCount > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 sm:mt-0 sm:text-right">
                      <p className="text-base font-bold text-foreground">
                        {formatMinorAmount(
                          decimalStringToMinor(order.vendorAmount, order.currency as "USD" | "CDF"),
                          order.currency as "USD" | "CDF",
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{order.currency}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
