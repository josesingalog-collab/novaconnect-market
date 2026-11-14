"use client";

import { useEffect, useActionState, useRef, useState, useTransition, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";

function money(amount: string, currency: string): string {
  return formatMinorAmount(
    parseAmountToMinor(amount, currency as CurrencyCode),
    currency as CurrencyCode,
  );
}

interface CheckoutCustomer {
  fullName: string;
  email: string;
  phone: string | null;
}

export function CheckoutView({
  authenticated,
  customer,
  mockPaymentEnabled,
}: {
  authenticated: boolean;
  customer: CheckoutCustomer | null;
  mockPaymentEnabled: boolean;
}) {
  const { items, clear } = useCart();
  const [state, formAction, pending] = useActionState(placeOrderAction, initialCheckoutState);
  const clearedOrderId = useRef<string | null>(null);

  // Vide le panier UNE seule fois, après création confirmée de la commande.
  useEffect(() => {
    if (
      state.status === "success" &&
      state.order !== null &&
      clearedOrderId.current !== state.order.orderId
    ) {
      clearedOrderId.current = state.order.orderId;
      clear();
    }
  }, [state, clear]);

  if (state.status === "success" && state.order !== null) {
    return <OrderConfirmation order={state.order} mockPaymentEnabled={mockPaymentEnabled} />;
  }

  if (!authenticated) {
    return (
      <EmptyState
        icon={<span aria-hidden="true">🔒</span>}
        title="Connexion requise"
        description="Connecte-toi pour finaliser ta commande — ton panier sera conservé."
        action={{ label: "Se connecter", href: "/login?next=/checkout" }}
      />
    );
  }

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
        title="Aucun article à commander"
        description="Découvrez nos produits numériques et trouvez les ressources dont vous avez besoin."
        action={{ label: "Explorer le catalogue", href: "/catalogue" }}
      />
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

      <div className="flex min-w-0 flex-1 flex-col gap-6">
        {customer !== null && (
          <Card variant="bordered" className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Informations personnelles
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ces coordonnées servent au suivi de votre commande.
                </p>
              </div>
              <Link
                href="/dashboard/profil"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Modifier
              </Link>
            </div>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-xs font-medium text-muted-foreground">Nom complet</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{customer.fullName}</dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <dt className="text-xs font-medium text-muted-foreground">Adresse e-mail</dt>
                <dd className="mt-1 truncate text-sm font-medium text-foreground">{customer.email}</dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Téléphone / WhatsApp</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">
                  {customer.phone ?? "Non renseigné"}
                </dd>
              </div>
            </dl>
          </Card>
        )}

        <section aria-labelledby="order-items-title">
          <h2 id="order-items-title" className="mb-3 text-lg font-semibold tracking-tight text-foreground">
            Votre commande
          </h2>
          <ul
            className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background"
            aria-label="Produits de la commande"
          >
            {items.map((item) => (
              <li key={item.productId} className="flex items-center gap-4 p-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted p-1 text-lg font-semibold text-muted-foreground">
                  {item.thumbnailUrl !== null ? (
                    // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par le vendeur
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full rounded object-contain" />
                  ) : (
                    item.title.charAt(0).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.storeName}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-foreground">
                  {money(item.price, item.currency)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section aria-label="Validation de commande" className="w-full shrink-0 lg:w-88 lg:sticky lg:top-6">
        <Card variant="bordered" className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Coût total
          </h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Articles ({items.length})</dt>
              <dd className="font-medium text-foreground">
                {money(displayTotalText, cartCurrency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
              <dt>Total</dt>
              <dd className="text-lg text-foreground">{money(displayTotalText, cartCurrency)}</dd>
            </div>
          </dl>

          <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-muted-foreground">
            <input
              type="checkbox"
              name="cgu"
              required
              className="border-input mt-0.5 h-4 w-4 rounded accent-primary"
            />
            <span>
              J&apos;accepte les conditions générales de vente et la politique de livraison
              numérique (fichiers accessibles dès confirmation du paiement).
            </span>
          </label>

          {state.status === "error" && state.error !== null && (
            <Alert variant="error" className="mt-4">
              <span>{state.error}</span>
              {(state.error.includes("plus disponible") ||
                state.error.includes("incompatible")) && (
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
            </Alert>
          )}

          <Alert variant="info" className="mt-4">
            <span className="text-xs leading-4">
              ✓ Produit numérique · ✓ Commande sécurisée · ✓ Accès après confirmation du paiement
            </span>
          </Alert>

          <Button type="submit" disabled={pending} variant="default" className="mt-5 w-full">
            {pending ? "Création de la commande…" : "Confirmer la commande"}
          </Button>

          <p className="mt-3 text-center text-xs leading-4 text-muted-foreground">
            Montants définitifs recalculés par le serveur. Paiement simulé (provider mock) — aucune
            somme réelle n&apos;est prélevée.
          </p>
        </Card>
      </section>
    </form>
  );
}

function OrderConfirmation({
  order,
  mockPaymentEnabled,
}: {
  order: NonNullable<CheckoutFormState["order"]>;
  mockPaymentEnabled: boolean;
}) {
  type OrderUiStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "REFUNDED" | "UNKNOWN";
  const [orderStatus, setOrderStatus] = useState<OrderUiStatus>("PENDING");
  const [payError, setPayError] = useState<string | null>(null);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [isPaying, startPaying] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingCancelledRef = useRef(false);

  const stopPolling = useCallback((): void => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const mapServerStatus = useCallback((status: string | null): OrderUiStatus => {
    if (status === null) return "UNKNOWN";
    if (status === "PENDING") return "PENDING";
    if (status === "PAID") return "PAID";
    if (status === "FAILED") return "FAILED";
    if (status === "CANCELLED") return "CANCELLED";
    if (status === "REFUNDED") return "REFUNDED";
    return "UNKNOWN";
  }, []);

  const tick = useCallback((): void => {
    void getMyOrderStatusAction(order.orderId)
      .then(({ status }) => {
        if (pollingCancelledRef.current) return;
        setPollingError(null);
        const uiStatus = mapServerStatus(status);
        setOrderStatus(uiStatus);
      })
      .catch(() => {
        if (pollingCancelledRef.current) return;
        setPollingError(
          "Impossible de vérifier le statut de la commande. Réessai automatique dans quelques secondes.",
        );
      });
  }, [order.orderId, mapServerStatus]);

  useEffect(() => {
    if (orderStatus !== "PENDING") {
      stopPolling();
      return;
    }
    pollingCancelledRef.current = false;
    tick();
    pollRef.current = setInterval(tick, 5000);
    return () => {
      pollingCancelledRef.current = true;
      stopPolling();
    };
  }, [order.orderId, orderStatus, tick, stopPolling]);

  const simulatePayment = (): void => {
    setPayError(null);
    setPollingError(null);
    startPaying(() => {
      void mockConfirmPaymentAction(order.orderId).then((result) => {
        if (result.ok) {
          setOrderStatus(
            result.orderStatus === "PAID" ? "PAID" : mapServerStatus(result.orderStatus),
          );
        } else {
          setPayError(result.error);
        }
      });
    });
  };

  const isPaid = orderStatus === "PAID";

  if (isPaid) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div
          role="status"
          className="rounded-xl border border-success/20 bg-success/5 p-8 text-center"
        >
          <p aria-hidden="true">
            <svg
              className="mx-auto h-12 w-12 text-success"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-success">
            Paiement confirmé — merci !
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-success">
            Commande <strong>{order.orderNumber}</strong> payée (
            {money(order.total, order.currency)}). Tes fichiers numériques sont accessibles depuis
            tes commandes.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.productTitle}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.storeName} · Qté {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-foreground">
                {money(item.lineTotal, item.currency)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/dashboard/commandes"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voir mes commandes
          </Link>
          <Link
            href="/catalogue"
            className="border-input rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Continuer mes achats
          </Link>
        </div>
      </div>
    );
  }

  if (orderStatus === "FAILED") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div
          role="alert"
          className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center"
        >
          <p aria-hidden="true">
            <svg
              className="mx-auto h-12 w-12 text-destructive"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-destructive">
            Commande {order.orderNumber} — Paiement échoué
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-destructive">
            Le paiement de {money(order.total, order.currency)} n&apos;a pas pu être confirmé.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.productTitle}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.storeName} · Qté {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-foreground">
                {money(item.lineTotal, item.currency)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/checkout"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Nouvelle tentative de paiement
          </Link>
          <Link
            href="/dashboard/commandes"
            className="border-input rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Voir mes commandes
          </Link>
        </div>
      </div>
    );
  }

  if (orderStatus === "CANCELLED") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div
          role="alert"
          className="rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900"
        >
          <p aria-hidden="true">
            <svg
              className="mx-auto h-12 w-12 text-zinc-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-foreground">
            Commande {order.orderNumber} — Annulée
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Cette commande a été annulée. Aucun montant n&apos;a été prélevé.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.productTitle}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.storeName} · Qté {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-foreground">
                {money(item.lineTotal, item.currency)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/checkout"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Passer une nouvelle commande
          </Link>
          <Link
            href="/dashboard/commandes"
            className="border-input rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Voir mes commandes
          </Link>
        </div>
      </div>
    );
  }

  if (orderStatus === "REFUNDED") {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div
          role="alert"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-800 dark:bg-emerald-950/30"
        >
          <p aria-hidden="true">
            <svg
              className="mx-auto h-12 w-12 text-emerald-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </p>
          <h2 className="mt-3 text-xl font-semibold tracking-tight text-emerald-700 dark:text-emerald-400">
            Commande {order.orderNumber} — Remboursée
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
            Le montant de {money(order.total, order.currency)} a été remboursé.
          </p>
        </div>

        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {item.productTitle}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {item.storeName} · Qté {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-sm font-bold text-foreground">
                {money(item.lineTotal, item.currency)}
              </p>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/catalogue"
            className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voir d&apos;autres produits
          </Link>
          <Link
            href="/dashboard/commandes"
            className="border-input rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            Voir mes commandes
          </Link>
        </div>
      </div>
    );
  }

  const isUnknown = orderStatus === "UNKNOWN";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div
        role="status"
        aria-live="polite"
        className="rounded-xl border border-warning/20 bg-warning/5 p-6 text-center"
      >
        <p aria-hidden="true">
          <svg
            className="mx-auto h-10 w-10 text-warning"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
          Commande {order.orderNumber} — en attente
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Total : <strong>{money(order.total, order.currency)}</strong> · Statut :{" "}
          <strong>{isUnknown ? "vérification du statut…" : "en attente de paiement"}</strong>
        </p>
      </div>

      {pollingError && (
        <Alert variant="error" className="mx-auto max-w-md">
          <span>{pollingError}</span>
          <Button variant="outline" size="sm" onClick={() => tick()} className="ml-2 shrink-0">
            Réessayer
          </Button>
        </Alert>
      )}

      {mockPaymentEnabled ? (
        <Alert variant="warning" title="Provider mock">
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-6">
              💳 Provider <strong>mock</strong> : confirme ci-dessous pour créditer les vendeurs et
              marquer la commande payée (aucun montant réel).
            </p>

            {payError !== null && (
              <Alert variant="error" className="mx-auto max-w-md">
                <span>{payError}</span>
              </Alert>
            )}

            <Button
              type="button"
              onClick={simulatePayment}
              disabled={isPaying}
              variant="default"
              className="mt-1"
            >
              {isPaying ? "Confirmation en cours…" : "Simuler le paiement"}
            </Button>

            <p className="inline-flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-500"
              />
              En attente du fournisseur de paiement… vérification automatique toutes les 5 s
            </p>
          </div>
        </Alert>
      ) : (
        <Alert variant="warning" title="Paiement bientôt disponible">
          Le paiement en ligne n&apos;est pas encore activé. Aucune somme n&apos;est prélevée.
        </Alert>
      )}

      <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
        {order.items.map((item) => (
          <li key={item.productId} className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">{item.productTitle}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {item.storeName} · Qté {item.quantity}
              </p>
            </div>
            <p className="shrink-0 text-sm font-bold text-foreground">
              {money(item.lineTotal, item.currency)}
            </p>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-center gap-3">
        <Link
          href="/dashboard/commandes"
          className="rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Voir mes commandes
        </Link>
        <Link
          href="/catalogue"
          className="border-input rounded-lg border px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Continuer mes achats
        </Link>
      </div>
    </div>
  );
}
