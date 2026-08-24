import Link from "next/link";
import { formatPrice } from "@/components/marketplace/format";
import type { PublicProduct } from "@/services/products/public";

export function ProductCard({ product }: { product: PublicProduct }) {
  return (
    <Link
      href={`/produit/${product.slug}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950"
    >
      <div className="flex aspect-video items-center justify-center bg-zinc-100 text-3xl font-semibold text-zinc-400 dark:bg-zinc-900 dark:text-zinc-600">
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
        <h3 className="line-clamp-2 text-sm font-semibold text-zinc-900 group-hover:underline dark:text-zinc-50">
          {product.title}
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">{product.storeName}</p>
        <p className="mt-auto text-sm font-bold text-zinc-900 dark:text-zinc-50">
          {formatPrice(product.price, product.currency)}
        </p>
      </div>
    </Link>
  );
}
