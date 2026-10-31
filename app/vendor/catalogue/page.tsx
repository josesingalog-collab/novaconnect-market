import Link from "next/link";
import { redirect } from "next/navigation";
import { SubmitProductForm } from "@/components/submit-product-form";
import { DeleteProductForm } from "@/components/delete-product-form";
import { formatPrice } from "@/components/marketplace/format";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listMyProducts, type SellerProduct } from "@/services/products/manage";

/* eslint-disable @next/next/no-img-element -- Les couvertures privées utilisent des URLs signées temporaires. */

type ProductStatusBadge = {
  label: string;
  variant: "secondary" | "warning" | "success" | "destructive" | "outline";
};

const PRODUCT_STATUS_BADGES: Record<string, ProductStatusBadge> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  PENDING_REVIEW: { label: "En vérification", variant: "warning" },
  PUBLISHED: { label: "Publié", variant: "success" },
  REJECTED: { label: "À corriger", variant: "destructive" },
  ARCHIVED: { label: "Archivé", variant: "outline" },
};

const DEFAULT_PRODUCT_STATUS_BADGE: ProductStatusBadge = PRODUCT_STATUS_BADGES.DRAFT ?? {
  label: "Brouillon",
  variant: "secondary",
};

const STATUS_FILTERS = [
  { value: "", label: "Tous les produits" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "PUBLISHED", label: "Publiés" },
  { value: "REJECTED", label: "À corriger" },
  { value: "ARCHIVED", label: "Archivés" },
] as const;

function parseSearchParams(raw: Record<string, string | string[] | undefined>) {
  const pick = (key: string): string => {
    const value = raw[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
  };
  return { q: pick("q"), status: pick("status") };
}

function ProductImage({ product }: { product: SellerProduct }) {
  return product.thumbnailUrl ? (
    <img
      src={product.thumbnailUrl}
      alt=""
      className="h-12 w-12 shrink-0 rounded-lg border border-border bg-muted object-cover"
    />
  ) : (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
      {product.title.charAt(0).toUpperCase()}
    </span>
  );
}

function ProductActions({ product }: { product: SellerProduct }) {
  const menu = (children: React.ReactNode) => (
    <details className="group relative inline-block text-left">
      <summary
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground [&::-webkit-details-marker]:hidden"
        aria-label={`Actions pour ${product.title}`}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.75h.01M12 12h.01M12 17.25h.01" />
        </svg>
      </summary>
      <div className="absolute top-full right-0 z-20 mt-2 flex min-w-40 flex-col gap-1 rounded-xl border border-border bg-card p-2 shadow-lg">
        {children}
      </div>
    </details>
  );

  if (product.status === "DRAFT") {
    return menu(
      <>
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link href={`/vendor/catalogue/${product.id}/edit`}>Modifier</Link>
        </Button>
        <SubmitProductForm productId={product.id} productTitle={product.title} compact />
        <DeleteProductForm productId={product.id} productTitle={product.title} compact />
      </>,
    );
  }

  if (product.status === "REJECTED") {
    return menu(
      <>
        <Button asChild size="sm" className="w-full justify-start">
          <Link href={`/vendor/catalogue/${product.id}/edit`}>Corriger</Link>
        </Button>
        <DeleteProductForm productId={product.id} productTitle={product.title} compact />
      </>,
    );
  }

  if (product.status === "PENDING_REVIEW") {
    return menu(
      <>
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link href={`/vendor/catalogue/${product.id}/preview`}>Voir</Link>
        </Button>
        <DeleteProductForm productId={product.id} productTitle={product.title} compact />
      </>,
    );
  }

  if (product.status === "PUBLISHED") {
    return menu(
      <>
        <Button asChild variant="outline" size="sm" className="w-full justify-start">
          <Link href={`/vendor/catalogue/${product.id}/edit`}>Modifier</Link>
        </Button>
        <Button asChild size="sm" className="w-full justify-start">
          <Link href={`/produit/${product.slug}`}>Voir</Link>
        </Button>
        <DeleteProductForm productId={product.id} productTitle={product.title} compact />
      </>,
    );
  }

  return menu(
    <>
      <Button asChild variant="outline" size="sm" className="w-full justify-start">
        <Link href={`/vendor/catalogue/${product.id}/edit`}>Voir</Link>
      </Button>
      <DeleteProductForm productId={product.id} productTitle={product.title} compact />
    </>,
  );
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const current = await getCurrentProfile();
  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    redirect("/vendor");
  }

  const supabase = await createSupabaseServerClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  const allProducts = vendor ? await listMyProducts(supabase, vendor.id) : [];
  const { q, status } = parseSearchParams(searchParams);
  const normalizedSearch = q.toLocaleLowerCase("fr-FR");
  const products = allProducts.filter(
    (product) =>
      (!normalizedSearch || product.title.toLocaleLowerCase("fr-FR").includes(normalizedSearch)) &&
      (!status || product.status === status),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6 lg:py-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Gestion du catalogue
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Produits</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Créez, publiez et gérez les produits de votre boutique.
          </p>
        </div>
        <Button asChild className="min-h-11 shrink-0">
          <Link href="/vendor/catalogue/nouveau">Créer un produit</Link>
        </Button>
      </header>

      <form
        method="get"
        action="/vendor/catalogue"
        className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
      >
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0z"
            />
          </svg>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Rechercher un produit…"
            aria-label="Rechercher un produit par titre"
            className="border-input min-h-11 w-full rounded-lg border bg-background py-2.5 pr-3 pl-10 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
          />
        </div>
        <select
          name="status"
          defaultValue={status}
          aria-label="Filtrer par statut"
          className="border-input min-h-11 rounded-lg border bg-background px-3 py-2.5 text-sm outline-none"
        >
          {STATUS_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </select>
        <Button type="submit" className="min-h-11">
          Rechercher
        </Button>
        {(q || status) && (
          <Link
            href="/vendor/catalogue"
            className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {products.length === 0 ? (
        <EmptyState
          icon={<span className="text-3xl" aria-hidden="true">{allProducts.length ? "⌕" : "▣"}</span>}
          title={allProducts.length ? "Aucun produit trouvé" : "Aucun produit pour le moment"}
          description={
            allProducts.length
              ? "Essayez une autre recherche ou modifiez le filtre."
              : "Créez votre premier produit pour commencer à remplir votre boutique."
          }
          action={
            allProducts.length
              ? { label: "Réinitialiser les filtres", href: "/vendor/catalogue" }
              : { label: "Créer un produit", href: "/vendor/catalogue/nouveau" }
          }
        />
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">
            {products.length} produit{products.length > 1 ? "s" : ""}
            {(q || status) && " correspondant à vos filtres"}
          </p>

          <div className="rounded-xl border border-border bg-card">
            <table className="hidden w-full text-left md:table">
              <thead className="border-b border-border bg-muted/40 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <tr>
                  <th className="px-5 py-3">Produit</th>
                  <th className="px-5 py-3">Prix</th>
                  <th className="px-5 py-3">Statut</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((product) => {
                  const badge = PRODUCT_STATUS_BADGES[product.status] ?? DEFAULT_PRODUCT_STATUS_BADGE;
                  return (
                    <tr key={product.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <Link href={`/vendor/catalogue/${product.id}/edit`} className="flex items-center gap-3">
                          <ProductImage product={product} />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {product.title}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {product.categoryName ?? "Sans catégorie"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-foreground">
                        {formatPrice(product.price, product.currency)}
                      </td>
                      <td className="px-5 py-4"><Badge variant={badge.variant}>{badge.label}</Badge></td>
                      <td className="px-5 py-4 text-right"><ProductActions product={product} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <ul className="divide-y divide-border md:hidden" aria-label="Produits">
              {products.map((product) => {
                const badge = PRODUCT_STATUS_BADGES[product.status] ?? DEFAULT_PRODUCT_STATUS_BADGE;
                return (
                  <li key={product.id} className="p-4">
                    <div className="flex items-start gap-3">
                      <ProductImage product={product} />
                      <Link href={`/vendor/catalogue/${product.id}/edit`} className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">{product.title}</p>
                        <p className="mt-1 text-sm font-semibold text-foreground">
                          {formatPrice(product.price, product.currency)}
                        </p>
                        <div className="mt-2"><Badge variant={badge.variant}>{badge.label}</Badge></div>
                      </Link>
                    </div>
                    {product.status === "REJECTED" && product.rejectionReason && (
                      <Alert variant="warning" className="mt-3">{product.rejectionReason}</Alert>
                    )}
                    <div className="mt-3"><ProductActions product={product} /></div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </main>
  );
}
