import Link from "next/link";
import { formatPrice } from "@/components/marketplace/format";
import type { PublicProduct } from "@/services/products/public";
import { Button } from "@/components/ui/button";

export function ProductCard({ product }: { product: PublicProduct }) {
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <Link href={`/produit/${product.slug}`} className="block">
        <div className="flex aspect-square items-center justify-center bg-muted p-2 text-3xl font-semibold text-muted-foreground">
          {product.thumbnailUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par le vendeur
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              className="h-full w-full rounded-lg border border-border/70 bg-card object-contain p-1"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center rounded-lg border border-border/70 bg-card">
              {product.title.charAt(0).toUpperCase()}
            </span>
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
        <Button asChild size="sm" className="min-h-[44px] w-full text-sm">
          <Link href={`/produit/${product.slug}`}>Acheter</Link>
        </Button>
      </div>
    </div>
  );
}
