import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMinorAmount, parseAmountToMinor, type CurrencyCode } from "@/lib/money";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata: Metadata = {
  title: "Mes commandes",
  robots: { index: false, follow: false },
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "En attente de paiement",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  PAID: {
    label: "Payée",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  CANCELLED: {
    label: "Annulée",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  REFUNDED: {
    label: "Remboursée",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

function money(amount: string, currency: string): string {
  return formatMinorAmount(
    parseAmountToMinor(amount, currency as CurrencyCode),
    currency as CurrencyCode,
  );
}

export default async function OrdersPage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/commandes");
  }
  if (current.kind === "missing-profile") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <Alert variant="error" title="Profil introuvable">
          Déconnectez-vous puis reconnectez-vous pour réessayer.
        </Alert>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, subtotal, discount, total, currency, status, created_at")
    .eq("buyer_id", current.profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const paidOrderIds = (orders ?? [])
    .filter((order) => order.status === "PAID")
    .map((order) => order.id);
  const { data: paidItems } =
    paidOrderIds.length > 0
      ? await supabase
          .from("order_items")
          .select("id, order_id, product_title")
          .in("order_id", paidOrderIds)
      : { data: null };

  const itemsByOrderId = new Map<string, Array<{ id: string; productTitle: string }>>();
  for (const item of paidItems ?? []) {
    const list = itemsByOrderId.get(item.order_id) ?? [];
    list.push({ id: item.id, productTitle: item.product_title });
    itemsByOrderId.set(item.order_id, list);
  }

  const filesByItemId = new Map<
    string,
    Array<{ id: string; fileName: string; fileSizeBytes: number }>
  >();
  await Promise.all(
    (paidItems ?? []).map(async (item) => {
      const { data } = await supabase.rpc("list_order_item_files", { p_order_item: item.id });
      filesByItemId.set(
        item.id,
        ((data ?? []) as Array<{ id: string; file_name: string; file_size_bytes: number }>).map(
          (file) => ({
            id: file.id,
            fileName: file.file_name,
            fileSizeBytes: Number(file.file_size_bytes),
          }),
        ),
      );
    }),
  );

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div>
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Mes commandes" }]} />
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Mes commandes
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Suivez l&apos;état de vos commandes et téléchargez vos fichiers numériques.
        </p>
      </div>

      {orders === null || orders.length === 0 ? (
        <EmptyState
          icon={
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
          }
          title="Aucune commande pour le moment"
          description="Découvrez les produits numériques disponibles sur SAVPAY."
          action={{ label: "Explorer le catalogue", href: "/catalogue" }}
        />
      ) : (
        <ul
          className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background"
          aria-label="Liste des commandes"
        >
          {orders.map((order) => {
            const badge = STATUS_BADGES[order.status] ?? {
              label: "Statut inconnu",
              className: "bg-muted text-muted-foreground",
            };
            const items = itemsByOrderId.get(order.id) ?? [];
            return (
              <li key={order.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <Badge className={badge.className} variant="outline">
                    {badge.label}
                  </Badge>
                  <p className="shrink-0 text-sm font-bold text-foreground">
                    {money(String(order.total), order.currency)}
                  </p>
                </div>

                {items.length ? (
                  <ul
                    className="flex flex-col gap-1.5 rounded-lg bg-muted p-3"
                    aria-label="Produits de la commande"
                  >
                    {items.map((item) => (
                      <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                        <span className="min-w-0 truncate text-muted-foreground">
                          {item.productTitle}
                        </span>
                        {order.status === "PAID" ? (
                          <div className="flex flex-wrap justify-end gap-1.5">
                            {(filesByItemId.get(item.id) ?? []).map((file) => (
                              <a
                                key={file.id}
                                href={`/api/downloads/${item.id}/${file.id}`}
                                className="shrink-0 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                              >
                                Télécharger {file.fileName}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <Link
        href="/dashboard"
        className="inline-block font-medium text-foreground underline-offset-4 hover:underline"
      >
        ← Retour au tableau de bord
      </Link>
    </main>
  );
}
