"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { formatPrice } from "@/components/marketplace/format";
import type { PublicProduct } from "@/services/products/public";
import { Button } from "@/components/ui/button";
import { useCart, type AddToCartResult } from "@/components/cart/cart-context";
import { FEEDBACK } from "@/components/cart/add-to-cart-button";

export function ProductCard({ product }: { product: PublicProduct }) {
  const { add, has } = useCart();
  const inCart = has(product.id);
  const [feedback, setFeedback] = useState<AddToCartResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (feedback !== null) {
      timerRef.current = setTimeout(() => setFeedback(null), 2000);
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [feedback]);

  function handleAdd() {
    const result = add({
      productId: product.id,
      slug: product.slug,
      title: product.title,
      price: product.price,
      currency: product.currency,
      storeName: product.storeName,
      thumbnailUrl: product.thumbnailUrl,
    });
    setFeedback(result);
  }

  function getButtonText(): string {
    if (feedback !== null) return FEEDBACK[feedback];
    if (inCart) return "✓ Dans le panier";
    return "Ajouter au panier";
  }

  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <Link href={`/produit/${product.slug}`} className="block">
        <div className="flex aspect-video items-center justify-center bg-muted text-3xl font-semibold text-muted-foreground">
          {product.thumbnailUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par le vendeur
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            product.title.charAt(0).toUpperCase()
          )}
        </div>
        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-base font-semibold text-foreground">{product.title}</h3>
          <p className="text-xs text-muted-foreground">{product.storeName}</p>
          <p className="mt-auto text-sm font-bold text-foreground">
            {formatPrice(product.price, product.currency)}
          </p>
        </div>
      </Link>
      <div className="border-t border-border px-4 pt-2 pb-4">
        <div className="flex gap-2">
          <Link href={`/produit/${product.slug}`} className="flex-1">
            <Button variant="outline" size="sm" className="min-h-[44px] w-full text-sm">
              Découvrir le produit
            </Button>
          </Link>
          <Button
            size="sm"
            type="button"
            className="min-h-[44px] flex-1 text-sm"
            disabled={inCart}
            onClick={handleAdd}
          >
            {getButtonText()}
          </Button>
        </div>
        <p
          role="status"
          aria-live="polite"
          className={`mt-1 min-h-5 text-center text-xs ${
            feedback === "added" || feedback === "duplicate"
              ? "font-medium text-success"
              : feedback === "currency-conflict"
                ? "font-medium text-warning"
                : "text-muted-foreground"
          }`}
        >
          {feedback !== null
            ? FEEDBACK[feedback]
            : inCart
              ? "✓ Présent dans le panier"
              : "Quantité unique · prix vérifié côté serveur au checkout"}
        </p>
      </div>
    </div>
  );
}
