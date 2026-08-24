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

const FEEDBACK: Record<AddToCartResult, string> = {
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
          className="flex-1 rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-400 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {inCart ? "✓ Dans le panier" : "🛒 Ajouter au panier"}
        </button>
        <Link
          href="/panier"
          className="rounded-lg border border-zinc-300 px-4 py-3 text-center text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Voir
        </Link>
      </div>
      <p
        role={feedback !== null ? "status" : undefined}
        aria-live="polite"
        className={`min-h-5 text-center text-xs ${
          feedback === FEEDBACK.added
            ? "font-medium text-emerald-600 dark:text-emerald-400"
            : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {feedback ?? "Quantité unique · prix vérifié côté serveur au checkout"}
      </p>
    </div>
  );
}
