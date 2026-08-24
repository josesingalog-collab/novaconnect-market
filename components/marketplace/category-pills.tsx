import Link from "next/link";
import type { PublicCategory } from "@/services/products/public";

export interface CatalogueRouteParams {
  categorie?: string;
  q?: string;
  tri?: string;
}

function buildHref(params: CatalogueRouteParams, categorieSlug: string | null): string {
  const search = new URLSearchParams();
  if (categorieSlug !== null) search.set("categorie", categorieSlug);
  if (params.q !== undefined && params.q.length > 0) search.set("q", params.q);
  if (params.tri !== undefined && params.tri !== "recent") search.set("tri", params.tri);
  const qs = search.toString();
  return qs.length > 0 ? `/catalogue?${qs}` : "/catalogue";
}

export function CategoryPills({
  categories,
  routeParams = {},
}: {
  categories: PublicCategory[];
  /** Présent sur le catalogue : gère la sélection et préserve les autres filtres. */
  routeParams?: CatalogueRouteParams;
}) {
  const onCatalogue = routeParams.categorie !== undefined;

  return (
    <ul className="flex flex-wrap gap-2">
      {categories.map((category) => {
        const isActive = onCatalogue && routeParams.categorie === category.slug;
        const nextSlug = isActive ? null : category.slug;
        const href =
          onCatalogue || isActive
            ? buildHref(routeParams, nextSlug)
            : `/catalogue?categorie=${encodeURIComponent(category.slug)}`;

        return (
          <li key={category.id}>
            <Link
              href={href}
              className={
                isActive
                  ? "inline-block rounded-full border border-zinc-900 bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
                  : "inline-block rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
              }
            >
              {category.name}
            </Link>
          </li>
        );
      })}
      {onCatalogue && routeParams.categorie !== undefined && (
        <li>
          <Link
            href={buildHref(routeParams, null)}
            className="inline-block rounded-full px-4 py-1.5 text-sm font-medium text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Toutes
          </Link>
        </li>
      )}
    </ul>
  );
}
