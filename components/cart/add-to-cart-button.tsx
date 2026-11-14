"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCart, type AddToCartResult } from "@/components/cart/cart-context";
import { formatPrice } from "@/components/marketplace/format";

interface AddToCartProduct {
  readonly productId: string;
  readonly slug: string;
  readonly title: string;
  readonly price: string;
  readonly currency: string;
  readonly storeName: string;
  readonly thumbnailUrl: string | null;
}

export const FEEDBACK: Record<AddToCartResult, string> = {
  added: "✓ Ajouté au panier",
  duplicate: "Déjà dans ton panier",
  "currency-conflict": "Devise différente : vide d'abord ton panier",
};

export function AddToCartButton({
  product,
  sticky = false,
}: {
  product: AddToCartProduct;
  sticky?: boolean;
}) {
  const { add, has } = useCart();
  const router = useRouter();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showSticky, setShowSticky] = useState(false);
  const inCart = has(product.productId);

  useEffect(() => {
    if (!sticky) return;

    const updateVisibility = () => setShowSticky(window.scrollY > 320);
    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    return () => window.removeEventListener("scroll", updateVisibility);
  }, [sticky]);

  function handleAdd() {
    const result = add(product);
    setFeedback(FEEDBACK[result]);
  }

  function handleBuyNow() {
    const result = add(product);
    if (result === "currency-conflict") {
      setFeedback(FEEDBACK[result]);
      return;
    }
    router.push("/checkout");
  }

  if (sticky) {
    if (!showSticky) return null;

    return (
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 p-3 shadow-float backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-foreground">
            {formatPrice(product.price, product.currency)}
          </p>
          <button
            type="button"
            onClick={handleBuyNow}
            className="rounded-lg bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Acheter
          </button>
        </div>
        {feedback !== null && (
          <p role="status" aria-live="polite" className="mx-auto mt-2 max-w-6xl text-xs text-muted-foreground">
            {feedback}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <button
        type="button"
        onClick={handleBuyNow}
        className="w-full rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Acheter
      </button>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={inCart}
          className="flex-1 rounded-lg border border-input bg-background px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
        >
          {inCart ? (
            "✓ Dans le panier"
          ) : (
            <>
              <svg
                className="mr-1 inline-block h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              Ajouter au panier
            </>
          )}
        </button>
        <Link
          href="/panier"
          className="border-input rounded-lg border bg-background px-4 py-3 text-center text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Voir
        </Link>
      </div>
      <p
        role={feedback !== null ? "status" : undefined}
        aria-live="polite"
        className={`min-h-5 text-center text-xs ${
          feedback === FEEDBACK.added ? "font-medium text-success" : "text-muted-foreground"
        }`}
      >
        {feedback ?? "Quantité unique · prix vérifié côté serveur au checkout"}
      </p>
    </div>
  );
}
