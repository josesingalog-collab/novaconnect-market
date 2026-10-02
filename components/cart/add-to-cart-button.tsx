"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart, type AddToCartResult } from "@/components/cart/cart-context";

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

export function AddToCartButton({ product }: { product: AddToCartProduct }) {
  const { add, has } = useCart();
  const [feedback, setFeedback] = useState<string | null>(null);
  const inCart = has(product.productId);

  function handleAdd() {
    const result = add(product);
    setFeedback(FEEDBACK[result]);
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleAdd}
          disabled={inCart}
          className="flex-1 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground"
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
