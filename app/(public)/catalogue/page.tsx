import type { Metadata } from "next";
import type { CatalogueRouteParams } from "@/components/marketplace/category-pills";
import { CataloguePagination } from "@/components/marketplace/pagination";
import { ProductCard } from "@/components/marketplace/product-card";
import { SearchBar } from "@/components/marketplace/search-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listPublicCategories,
  listPublicProducts,
  MAX_PAGE_SIZE,
  type ProductSort,
} from "@/services/products/public";

export const metadata: Metadata = {
  title: "Catalogue — SAVPAY",
  description:
    "Découvrez des formations, ebooks, templates et ressources numériques pour apprendre, travailler et développer vos projets.",
  robots: { index: true, follow: true },
};

const VALID_SORTS: readonly string[] = ["recent", "price_asc", "price_desc"];

function parseRouteParams(
  raw: Record<string, string | string[] | undefined>,
): CatalogueRouteParams & { page: number } {
  const pick = (key: string): string | undefined => {
    const value = raw[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
  };

  const tri = pick("tri");
  const pageRaw = Number.parseInt(pick("page") ?? "1", 10);

  return {
    categorie: pick("categorie"),
    q: pick("q"),
    tri: tri !== undefined && VALID_SORTS.includes(tri) ? tri : undefined,
    page: Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : Math.min(pageRaw, 1000),
  };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseRouteParams(await searchParams);
  const db = await createSupabaseServerClient();

  const categories = await listPublicCategories(db);
  const activeCategory =
    params.categorie !== undefined
      ? (categories.find((category) => category.slug === params.categorie) ?? null)
      : null;

  const [productsPage] = await Promise.all([
    listPublicProducts(db, {
      page: params.page,
      categoryId: activeCategory?.id,
      search: params.q,
      sort: (params.tri as ProductSort | undefined) ?? "recent",
    }),
  ]);

  const hasActiveFilters =
    activeCategory !== null ||
    (params.q !== undefined && params.q.length > 0) ||
    params.tri !== undefined;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      {/* HÉROS */}
      <section className="flex flex-col items-center gap-6 py-16 text-center sm:py-24">
        <Badge variant="outline" className="text-xs font-medium">
          Catalogue — SAVPAY
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Découvrez des ressources qui vous font avancer.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted-foreground">
          Formations, ebooks, templates et ressources numériques pour apprendre, travailler et
          développer vos projets.
        </p>
      </section>

      {/* RECHERCHE ET FILTRES */}
      <section aria-label="Recherche et filtres" className="scroll-mt-20">
        <SearchBar
          categories={categories}
          params={{ q: params.q, tri: params.tri, categorie: params.categorie }}
        />
      </section>

      {/* RÉSULTATS */}
      {productsPage.total > 0 && (
        <p className="mt-8 text-sm text-muted-foreground" role="status">
          {productsPage.total} produit{productsPage.total > 1 ? "s" : ""} trouvé
          {productsPage.total > 1 ? "s" : ""}
          {hasActiveFilters ? " avec vos filtres" : ""}
        </p>
      )}

      {productsPage.products.length > 0 ? (
        <>
          <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {productsPage.products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="mt-10">
            <CataloguePagination
              page={productsPage.page}
              pageSize={MAX_PAGE_SIZE}
              total={productsPage.total}
              routeParams={params}
            />
          </div>
        </>
      ) : (
        <EmptyState
          icon={
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          }
          title={
            hasActiveFilters ? "Aucun produit trouvé" : "Les premiers produits arrivent bientôt"
          }
          description={
            hasActiveFilters
              ? "Essayez une autre recherche ou choisissez une autre catégorie."
              : "Découvrez bientôt une sélection de ressources numériques créées par notre communauté."
          }
          action={
            hasActiveFilters
              ? { label: "Voir le catalogue", href: "/catalogue" }
              : { label: "Voir le catalogue", href: "/catalogue" }
          }
        />
      )}
    </main>
  );
}
