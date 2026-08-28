import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  formatMinorAmount,
  parseAmountToMinor,
  type CurrencyCode,
} from "@/lib/money";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mes commandes",
  robots: { index: false, follow: false },
};

const FALLBACK_BADGE = {
  label: "Statut inconnu",
  className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
} as const;

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
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Profil introuvable. Déconnecte-toi puis reconnecte-toi pour réessayer.
        </div>
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();

  // Lecture via RLS (orders_select_own_or_admin) : uniquement SES commandes.
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, subtotal, discount, total, currency, status, created_at")
    .eq("buyer_id", current.profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Lignes des commandes payées uniquement (RLS order_items_select) :
  // le téléchargement est dérivé du statut PAID, jamais mémorisé ailleurs.
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
          NovaConnect Market · Commandes
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Mes commandes
        </h1>
      </div>

      {orders === null || orders.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
          <p aria-hidden className="text-3xl">📦</p>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Aucune commande pour le moment
          </h2>
          <Link
            href="/catalogue"
            className="mt-5 inline-block rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Explorer le catalogue
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {orders.map((order) => {
            const badge = STATUS_BADGES[order.status] ?? FALLBACK_BADGE;
            return (
              <li key={order.id} className="flex flex-col gap-3 p-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {order.order_number}
                    </p>
                    <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <p className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                    {money(String(order.total), order.currency)}
                  </p>
                </div>

                {itemsByOrderId.get(order.id)?.length ? (
                  <ul className="flex flex-col gap-1.5 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-900/60">
                    {itemsByOrderId.get(order.id)?.map((item) => (
                      <li
                        key={item.id}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                          {item.productTitle}
                        </span>
                        {order.status === "PAID" ? (
                          <a
                            href={`/api/downloads/${item.id}`}
                            className="shrink-0 rounded-md bg-zinc-900 px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
                          >
                            Télécharger
                          </a>
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

      <Link href="/dashboard" className="inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
        ← Retour au tableau de bord
      </Link>
    </main>
  );
}
