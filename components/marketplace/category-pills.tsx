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
        const href = buildHref(routeParams, nextSlug);

        return (
          <li key={category.id}>
            <Link
              href={href}
              className={
                isActive
                  ? "border-input inline-block rounded-full border bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground"
                  : "border-input inline-block rounded-full border bg-background px-4 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
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
            className="inline-block rounded-full px-4 py-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Toutes
          </Link>
        </li>
      )}
    </ul>
  );
}
