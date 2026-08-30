import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { listMyProducts } from "@/services/products/manage";
import { formatPrice } from "@/components/marketplace/format";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const PRODUCT_STATUS_BADGES: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  PENDING_REVIEW: { label: "En relecture", variant: "warning" },
  PUBLISHED: { label: "Publié", variant: "success" },
  REJECTED: { label: "Rejeté", variant: "destructive" },
  ARCHIVED: { label: "Archivé", variant: "outline" },
};

export default async function CataloguePage() {
  const current = await getCurrentProfile();

  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    redirect("/vendor");
  }

  const supabase = await createSupabaseServerClient();
  const products = await listMyProducts(supabase, current.profile.id);

  return (
    <div className="mx-auto max-w-5xl flex-1 flex flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          NovaConnect Market · Catalogue
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mon catalogue</h1>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {products.length} produit{products.length > 1 ? "s" : ""}
        </p>
        <Link
          href="/vendor/catalogue/nouveau"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          + Nouveau produit
        </Link>
      </div>

      {products.length === 0 ? (
        <EmptyState
          icon={<span className="text-3xl" aria-hidden="true">📦</span>}
          title="Aucun produit pour le moment"
          description="Crée ton premier produit pour le proposer à la vente."
          action={{ label: "Créer ton premier produit", href: "/vendor/catalogue/nouveau" }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {products.map((product) => {
            const productStatus = product.status as keyof typeof PRODUCT_STATUS_BADGES;
            const badge = (PRODUCT_STATUS_BADGES[productStatus] ?? PRODUCT_STATUS_BADGES.DRAFT) as { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" };
            return (
              <li key={product.id}>
                <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex aspect-video items-center justify-center bg-muted text-3xl font-semibold text-muted-foreground">
                    {product.thumbnailUrl ? (
                      <img src={product.thumbnailUrl} alt={product.title} className="h-full w-full object-cover" />
                    ) : (
                      product.title.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <h3 className="line-clamp-2 text-sm font-semibold text-foreground">{product.title}</h3>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">{formatPrice(product.price, product.currency)}</span>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2 border-t border-border p-4 pt-0">
                    <Link
                      href={`/vendor/catalogue/${product.id}/edit`}
                      className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      Modifier
                    </Link>
                    <Link
                      href={`/vendor/catalogue/${product.id}/edit`}
                      className="inline-flex items-center justify-center rounded-lg border border-input px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Fichier
                    </Link>
                    <Link
                      href={`/produit/${encodeURIComponent(product.slug)}`}
                      className="inline-flex items-center justify-center rounded-lg border border-input px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      Aperçu
                    </Link>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}