import Link from "next/link";
import type { CatalogueRouteParams } from "@/components/marketplace/category-pills";

function buildHref(params: CatalogueRouteParams, page: number): string {
  const search = new URLSearchParams();
  if (params.categorie !== undefined) search.set("categorie", encodeURIComponent(params.categorie));
  if (params.q !== undefined && params.q.length > 0) search.set("q", encodeURIComponent(params.q));
  if (params.tri !== undefined && params.tri !== "recent") search.set("tri", params.tri);
  if (page > 1) search.set("page", String(page));
  const qs = search.toString();
  return qs.length > 0 ? `/catalogue?${qs}` : "/catalogue";
}

export function CataloguePagination({
  page,
  pageSize,
  total,
  routeParams,
  baseHref,
}: {
  page: number;
  pageSize: number;
  total: number;
  routeParams?: CatalogueRouteParams;
  baseHref?: string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const prevHref = baseHref
    ? `${baseHref}?page=${page - 1}`
    : buildHref(routeParams ?? {}, page - 1);
  const nextHref = baseHref
    ? `${baseHref}?page=${page + 1}`
    : buildHref(routeParams ?? {}, page + 1);

  if (lastPage <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination"
      className="flex items-center justify-between gap-4 border-t border-border pt-6"
    >
      {page > 1 ? (
        <Link
          href={prevHref}
          className="border-input rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          ← Précédent
        </Link>
      ) : (
        <span
          aria-hidden
          className="border-input rounded-lg border bg-muted px-4 py-2 text-sm text-muted-foreground"
        >
          ← Précédent
        </span>
      )}

      <p className="text-sm text-muted-foreground">
        Page <span className="font-semibold text-foreground">{page}</span> sur {lastPage} · {total}{" "}
        produit{total > 1 ? "s" : ""}
      </p>

      {page < lastPage ? (
        <Link
          href={nextHref}
          className="border-input rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Suivant →
        </Link>
      ) : (
        <span
          aria-hidden
          className="border-input rounded-lg border bg-muted px-4 py-2 text-sm text-muted-foreground"
        >
          Suivant →
        </span>
      )}
    </nav>
  );
}
