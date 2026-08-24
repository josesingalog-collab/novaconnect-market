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
      className="relative rounded-lg border border-zinc-300 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      <span aria-hidden>🛒</span>
      {count > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-900 px-1 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
