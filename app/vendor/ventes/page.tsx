import type { Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getSalesSummary, listSales } from "@/services/vendor/sales";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMinorAmount, decimalStringToMinor } from "@/lib/money";

export const metadata: Metadata = {
  title: "Mes ventes - NovaConnect",
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

function formatDate(date: string) {
  return new Date(date).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function VentesPage() {
  const vendorId = await getVendorId();
  const supabase = await createSupabaseServerClient();
  const summary = vendorId
    ? await getSalesSummary(supabase, vendorId)
    : { totalSales: 0, revenuesByCurrency: [], recentOrders: [] };
  const orders = vendorId ? await listSales(supabase, vendorId, 25) : [];
  const totalRevenue =
    summary.revenuesByCurrency
      .map((revenue) =>
        formatMinorAmount(
          decimalStringToMinor(revenue.totalRevenue, revenue.currency as "USD" | "CDF"),
          revenue.currency as "USD" | "CDF",
        ),
      )
      .join(" · ") || "0";

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-8 lg:px-8 lg:py-9">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            NovaConnect vendeur
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-foreground">Ventes</h1>
        </div>
        <button
          type="button"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-white shadow-lg shadow-primary/15"
        >
          <span aria-hidden="true">↓</span> Exporter les données
        </button>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Résumé des ventes">
        <Metric
          label="Ventes totales"
          value={summary.totalSales.toString()}
          icon="⌁"
          description="Commandes payées"
        />
        <Metric
          label="Revenus totaux"
          value={totalRevenue}
          icon="◒"
          description="Part vendeur cumulée"
        />
        <Metric
          label="Ventes terminées"
          value={summary.totalSales.toString()}
          icon="✓"
          description="Paiements confirmés"
        />
      </section>

      <section className="flex flex-col gap-5" aria-label="Historique des ventes">
        <form className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <input
            className="h-12 rounded-xl border border-border bg-card px-4 text-sm outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder="Rechercher par référence"
            name="search"
          />
          <input
            className="h-12 rounded-xl border border-border bg-card px-4 text-sm text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            type="date"
            name="date"
          />
          <select
            className="h-12 rounded-xl border border-border bg-card px-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            name="status"
            defaultValue=""
          >
            <option value="">Tous les statuts</option>
            <option value="PAID">Payées</option>
            <option value="PENDING">En attente</option>
            <option value="REFUNDED">Remboursées</option>
          </select>
        </form>

        {orders.length === 0 ? (
          <EmptyState
            title="Vos ventes apparaîtront ici"
            description="Les commandes payées de votre boutique seront listées dans cet espace."
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead className="bg-muted text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-5 py-4">Référence</th>
                    <th className="px-5 py-4">Produits</th>
                    <th className="px-5 py-4">Date</th>
                    <th className="px-5 py-4">Statut</th>
                    <th className="px-5 py-4 text-right">Revenu vendeur</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {orders.map((order) => {
                    const badge = ORDER_STATUS_LABELS[order.status] ?? {
                      label: order.status,
                      variant: "secondary" as const,
                    };
                    return (
                      <tr key={order.id} className="transition-colors hover:bg-primary/[0.025]">
                        <td className="px-5 py-5 font-semibold text-foreground">
                          {order.orderNumber}
                        </td>
                        <td className="px-5 py-5 text-muted-foreground">
                          {order.productCount} produit{order.productCount > 1 ? "s" : ""}
                        </td>
                        <td className="px-5 py-5 text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </td>
                        <td className="px-5 py-5">
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </td>
                        <td className="px-5 py-5 text-right font-semibold text-foreground">
                          {formatMinorAmount(
                            decimalStringToMinor(
                              order.vendorAmount,
                              order.currency as "USD" | "CDF",
                            ),
                            order.currency as "USD" | "CDF",
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  description,
}: {
  label: string;
  value: string;
  icon: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg font-semibold text-primary">
          {icon}
        </span>
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
