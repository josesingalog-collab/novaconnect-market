"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import { addMinors, formatMinorAmount, parseAmountToMinor, type CurrencyCode } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";

export function CartView({ authenticated }: { authenticated: boolean }) {
  const { items, currency, remove, clear } = useCart();

  if (items.length === 0) {
    return (
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
              d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        }
        title="Votre panier est vide"
        description="Découvrez nos produits digitaux et trouvez les ressources dont vous avez besoin."
        action={{ label: "Découvrir le catalogue", href: "/catalogue" }}
      />
    );
  }

  const cartCurrency = currency as CurrencyCode;
  const total = items.reduce(
    (sum, item) => addMinors(sum, parseAmountToMinor(item.price, cartCurrency)),
    0n,
  );

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      {/* LISTE DES PRODUITS */}
      <ul
        className="flex flex-1 flex-col divide-y divide-border rounded-xl border border-border bg-background lg:max-w-[60%]"
        aria-label="Produits dans le panier"
      >
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 p-4">
            <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted text-xl font-semibold text-muted-foreground">
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
                className="block truncate text-sm font-semibold text-foreground hover:underline"
              >
                {item.title}
              </Link>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.storeName} · Qté 1 (produit numérique)
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-foreground">
              {formatMinorAmount(
                parseAmountToMinor(item.price, item.currency as CurrencyCode),
                item.currency as CurrencyCode,
              )}
            </p>
            <button
              type="button"
              onClick={() => remove(item.productId)}
              aria-label={`Retirer ${item.title} du panier`}
              className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>

      {/* RÉSUMÉ */}
      <section aria-label="Résumé de la commande" className="w-full shrink-0 lg:w-80">
        <Card variant="bordered" className="p-6">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Résumé de la commande
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Articles ({items.length})</dt>
              <dd className="font-medium text-foreground">
                {formatMinorAmount(total, cartCurrency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold dark:border-border">
              <dt>Total</dt>
              <dd className="text-lg text-foreground">{formatMinorAmount(total, cartCurrency)}</dd>
            </div>
          </dl>

          {authenticated ? (
            <Link href="/checkout" className="mt-5 block">
              <Button variant="default" className="w-full">
                Passer au checkout
              </Button>
            </Link>
          ) : (
            <>
              <Link href="/login?next=/checkout" className="mt-5 block">
                <Button variant="default" className="w-full">
                  Se connecter pour commander
                </Button>
              </Link>
              <p className="mt-2 text-center text-xs leading-5 text-muted-foreground">
                Ta commande sera finalisée après connexion.
              </p>
            </>
          )}

          <button
            type="button"
            onClick={clear}
            className="border-input mt-3 block w-full rounded-lg border bg-background px-4 py-2.5 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          >
            Vider le panier
          </button>

          <Alert variant="info" className="mt-4">
            <span className="text-xs leading-4">
              Prix indicatifs — recalculés côté serveur au checkout. Paiement à venir (Phase 7).
            </span>
          </Alert>
        </Card>
      </section>
    </div>
  );
}
