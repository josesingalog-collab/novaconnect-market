"use client";

import { useEffect, useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  getMyOrderStatusAction,
  mockConfirmPaymentAction,
  placeOrderAction,
} from "@/app/actions/checkout";
import { initialCheckoutState, type CheckoutFormState } from "@/lib/checkout-form-state";
import { useCart } from "@/components/cart/cart-context";
import {
  formatMinorAmount,
  minorToDecimalString,
  parseAmountToMinor,
  type CurrencyCode,
} from "@/lib/money";

function money(amount: string, currency: string): string {
  return formatMinorAmount(parseAmountToMinor(amount, currency as CurrencyCode), currency as CurrencyCode);
}

export function CheckoutView({ authenticated }: { authenticated: boolean }) {
  const { items, clear } = useCart();
  const [state, formAction, pending] = useActionState(placeOrderAction, initialCheckoutState);
  const clearedOrderId = useRef<string | null>(null);

  // Vide le panier UNE seule fois, après création confirmée de la commande.
  useEffect(() => {
    if (state.status === "success" && state.order !== null && clearedOrderId.current !== state.order.orderId) {
      clearedOrderId.current = state.order.orderId;
      clear();
    }
  }, [state, clear]);

  if (state.status === "success" && state.order !== null) {
    return <OrderConfirmation order={state.order} />;
  }

  if (!authenticated) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p aria-hidden className="text-3xl">🔒</p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Connexion requise
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          Connecte-toi pour finaliser ta commande — ton panier sera conservé.
        </p>
        <Link
          href="/login?next=/checkout"
          className="mt-5 inline-block rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Se connecter
        </Link>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
        <p aria-hidden className="text-3xl">🛒</p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Aucun article à commander
        </h2>
        <Link
          href="/catalogue"
          className="mt-5 inline-block rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Explorer le catalogue
        </Link>
      </div>
    );
  }

  const cartCurrency = items[0]?.currency ?? "USD";
  const displayTotal = items.reduce(
    (sum, item) => sum + parseAmountToMinor(item.price, cartCurrency as CurrencyCode),
    0n,
  );
  const displayTotalText = minorToDecimalString(displayTotal, cartCurrency as CurrencyCode);

  return (
    <form action={formAction} className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <input
        type="hidden"
        name="productIds"
        value={JSON.stringify(items.map((item) => item.productId))}
      />

      <ul className="flex flex-1 flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {items.map((item) => (
          <li key={item.productId} className="flex items-center gap-4 p-4">
            <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 text-lg font-semibold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-600">
              {item.thumbnailUrl !== null ? (
                // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par le vendeur
                <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                item.title.charAt(0).toUpperCase()
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{item.title}</p>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{item.storeName}</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {money(item.price, item.currency)}
            </p>
          </li>
        ))}
      </ul>

      <section
        aria-label="Validation de commande"
        className="w-full shrink-0 rounded-xl border border-zinc-200 bg-white p-6 lg:w-96 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Validation
        </h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-zinc-500 dark:text-zinc-400">Articles ({items.length})</dt>
            <dd className="font-medium text-zinc-900 dark:text-zinc-100">{money(displayTotalText, cartCurrency)}</dd>
          </div>
          <div className="flex justify-between border-t border-zinc-200 pt-2 text-base font-bold dark:border-zinc-800">
            <dt>Total indicatif</dt>
            <dd>{money(displayTotalText, cartCurrency)}</dd>
          </div>
        </dl>

        <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            name="cgu"
            required
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 accent-zinc-900 dark:border-zinc-700"
          />
          <span>
            J&apos;accepte les conditions générales de vente et la politique de
            livraison numérique (fichiers accessibles dès confirmation du paiement).
          </span>
        </label>

        {state.status === "error" && state.error !== null && (
          <div role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
            {(state.error.includes("plus disponible") || state.error.includes("incompatible")) && (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => window.location.reload()}
                  className="font-semibold underline underline-offset-2"
                >
                  Actualiser
                </button>
              </>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-5 block w-full rounded-lg bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Création de la commande…" : "Valider ma commande"}
        </button>

        <p className="mt-3 text-center text-[11px] leading-4 text-zinc-400 dark:text-zinc-500">
          Montants définitifs recalculés par le serveur. Paiement simulé
          (provider mock) — aucune somme réelle n&apos;est prélevée.
        </p>
      </section>
    </form>
  );
}

function OrderConfirmation({ order }: { order: NonNullable<CheckoutFormState["order"]> }) {
  const [orderStatus, setOrderStatus] = useState<"PENDING" | "PAID" | "OTHER">("PENDING");
  const [payError, setPayError] = useState<string | null>(null);
  const [isPaying, startPaying] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = (): void => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  // Polling du statut serveur tant que la commande est PENDING : le webhook
  // (ou toute autre source) peut confirmer le paiement de l'extérieur.
  useEffect(() => {
    if (orderStatus !== "PENDING") {
      stopPolling();
      return;
    }
    let cancelled = false;
    const tick = (): void => {
      void getMyOrderStatusAction(order.orderId).then(({ status }) => {
        if (cancelled) return;
        if (status === "PAID") {
          setOrderStatus("PAID");
        } else if (status === null) {
          setOrderStatus("OTHER");
        }
      });
    };
    pollRef.current = setInterval(tick, 3000);
    return () => {
      cancelled = true;
      stopPolling();
    };
  }, [order.orderId, orderStatus]);

  const simulatePayment = (): void => {
    setPayError(null);
    startPaying(() => {
      void mockConfirmPaymentAction(order.orderId).then((result) => {
        if (result.ok) {
          setOrderStatus(result.orderStatus === "PAID" ? "PAID" : "OTHER");
        } else {
          setPayError(result.error);
        }
      });
    });
  };

  if (orderStatus === "PAID") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <p aria-hidden className="text-4xl">🎉</p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-emerald-800 dark:text-emerald-300">
            Paiement confirmé — merci !
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-emerald-700 dark:text-emerald-400">
            Commande <strong>{order.orderNumber}</strong> payée (
            {money(order.total, order.currency)}). Tes fichiers numériques sont
            accessibles depuis tes commandes.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                  {item.productTitle}
                </p>
                <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                  {item.storeName} · Qté {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-100">
                {money(item.lineTotal, item.currency)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/commandes"
            className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Voir mes commandes
          </Link>
          <Link
            href="/catalogue"
            className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Continuer mes achats
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
        <p aria-hidden className="text-3xl">🧾</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-emerald-800 dark:text-emerald-300">
          Commande {order.orderNumber} créée
        </h2>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-400">
          Total : <strong>{money(order.total, order.currency)}</strong> · Statut :{" "}
          <strong>en attente de paiement</strong>
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-center dark:border-amber-900 dark:bg-amber-950/40">
        <p className="text-sm leading-6 text-amber-800 dark:text-amber-300">
          💳 Provider <strong>mock</strong> : confirme ci-dessous pour créditer
          les vendeurs et marquer la commande payée (aucun montant réel).
        </p>

        {payError !== null && (
          <div role="alert" className="mx-auto mt-3 max-w-md rounded-lg bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {payError}
          </div>
        )}

        <button
          type="button"
          onClick={simulatePayment}
          disabled={isPaying}
          className="mt-4 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isPaying ? "Confirmation en cours…" : "Simuler le paiement"}
        </button>

        <p className="mt-3 inline-flex items-center justify-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
          <span aria-hidden className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500" />
          En attente du fournisseur de paiement… vérification automatique toutes les 3 s
        </p>
      </div>

      <ul className="flex flex-col divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                {item.productTitle}
              </p>
              <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                {item.storeName} · Qté {item.quantity}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-zinc-900 dark:text-zinc-100">
              {money(item.lineTotal, item.currency)}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard/commandes"
          className="rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Voir mes commandes
        </Link>
        <Link
          href="/catalogue"
          className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
