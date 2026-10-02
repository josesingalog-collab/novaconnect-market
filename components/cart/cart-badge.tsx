"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";

export function CartBadge() {
  const { items } = useCart();
  const count = items.length;

  return (
    <Link
      href="/panier"
      aria-label={`Panier${count > 0 ? ` (${count} article${count > 1 ? "s" : ""})` : ""}`}
      className="border-input relative rounded-lg border px-2.5 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span aria-hidden="true">
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
      </span>
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
