"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import {
  addMinors,
  formatMinorAmount,
  parseAmountToMinor,
  type CurrencyCode,
} from "@/lib/money";

export function CartView({ authenticated }: { authenticated: boolean }) {
  const { items, currency, remove, clear } = useCart();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p aria-hidden className="text-3xl">🛒</p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Ton panier est vide
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Parcours le catalogue et ajoute des produits numériques : ebooks,
          formations, templates…
        </p>
        <Link
          href="/catalogue"
          className="mt-5 inline-block rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Explorer le catalogue
        </Link>
      </div>
    );
  }

  const cartCurrency = currency as CurrencyCode;
  const total = items.reduce(
    (sum, item) => addMinors(sum, parseAmountToMinor(item.price, cartCurrency)),
    0n,
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <ul className="flex flex-1 flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 p-4">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 text-xl font-semibold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600">
              {item.thumbnailUrl !== null ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par le vendeur
                <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                item.title.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/produit/${encodeURIComponent(item.slug)}`}
                className="block truncate text-sm font-semibold text-zinc-900 hover:underline dark:text-zinc-50"
              >
                {item.title}
              </Link>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {item.storeName} · Qté 1 (produit numérique)
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {formatMinorAmount(parseAmountToMinor(item.price, item.currency as CurrencyCode), item.currency as CurrencyCode)}
            </p>
            <button
              type="button"
              onClick={() => remove(item.productId)}
              aria-label={`Retirer ${item.title} du panier`}
              className="shrink-0 rounded-lg p-2 text-zinc-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      <section
        aria-label="Récapitulatif"
        className="w-full shrink-0 rounded-xl border border-zinc-200 bg-white p-6 lg:w-80 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Récapitulatif
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">
              Articles ({items.length})
            </dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">
              {formatMinorAmount(total, cartCurrency)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold dark:border-zinc-800">
            <dt>Total</dt>
            <dd>{formatMinorAmount(total, cartCurrency)}</dd>
          </div>
        </dl>

        {authenticated ? (
          <Link
            href="/checkout"
            className="mt-5 block rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Passer au checkout
          </Link>
        ) : (
          <>
            <Link
              href="/login?next=/checkout"
              className="mt-5 block rounded-lg bg-zinc-900 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Se connecter pour commander
            </Link>
            <p className="mt-2 text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Ta commande sera finalisée après connexion.
            </p>
          </>
        )}

        <button
          type="button"
          onClick={clear}
          className="mt-3 block w-full rounded-lg border border-zinc-300 px-4 py-2 text-center text-xs font-medium text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
        >
          Vider le panier
        </button>

        <p className="mt-4 text-center text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
          Prix indicatifs — recalculés côté serveur au checkout. Paiement à venir
          (Phase 7).
        </p>
      </section>
    </div>
  );
}
