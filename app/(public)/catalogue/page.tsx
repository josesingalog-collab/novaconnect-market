import type { Metadata } from "next";
import Link from "next/link";
import { CategoryPills, type CatalogueRouteParams } from "@/components/marketplace/category-pills";
import { CataloguePagination } from "@/components/marketplace/pagination";
import { ProductCard } from "@/components/marketplace/product-card";
import { SearchBar } from "@/components/marketplace/search-bar";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  listPublicCategories,
  listPublicProducts,
  MAX_PAGE_SIZE,
  type ProductSort,
} from "@/services/products/public";

export const metadata: Metadata = {
  title: "Catalogue",
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
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
          NovaConnect Market · Marketplace
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Catalogue{activeCategory !== null ? ` — ${activeCategory.name}` : ""}
        </h1>
      </div>

      <section aria-label="Filtres du catalogue" className="mt-8 flex flex-col gap-4">
        <SearchBar params={{ q: params.q, tri: params.tri, categorie: params.categorie }} />
        {categories.length > 0 && (
          <CategoryPills categories={categories} routeParams={params} />
        )}
      </section>

      {productsPage.total > 0 && (
        <p className="mt-6 text-sm text-zinc-500 dark:text-zinc-400" role="status">
          {productsPage.total} produit{productsPage.total > 1 ? "s" : ""} trouvé
          {productsPage.total > 1 ? "s" : ""}
          {hasActiveFilters ? " avec vos filtres" : ""}
        </p>
      )}

      {productsPage.products.length > 0 ? (
        <>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="mt-10 rounded-xl border border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            {hasActiveFilters
              ? "Aucun produit ne correspond à votre recherche."
              : "Le catalogue est en préparation — les premiers produits arrivent bientôt."}
          </p>
          {hasActiveFilters && (
            <Link
              href="/catalogue"
              className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Voir tout le catalogue
            </Link>
          )}
        </div>
      )}
    </main>
  );
}
