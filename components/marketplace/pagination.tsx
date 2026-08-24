import Link from "next/link";
import type { CatalogueRouteParams } from "@/components/marketplace/category-pills";

function buildHref(params: CatalogueRouteParams, page: number): string {
  const search = new URLSearchParams();
  if (params.categorie !== undefined) search.set("categorie", params.categorie);
  if (params.q !== undefined && params.q.length > 0) search.set("q", params.q);
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
}: {
  page: number;
  pageSize: number;
  total: number;
  routeParams: CatalogueRouteParams;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  if (lastPage <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Pagination du catalogue"
      className="flex items-center justify-between gap-4 border-t border-zinc-200 pt-6 dark:border-zinc-800"
    >
      {page > 1 ? (
        <Link
          href={buildHref(routeParams, page - 1)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          ← Précédent
        </Link>
      ) : (
        <span aria-hidden className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-300 dark:border-zinc-800 dark:text-zinc-700">
          ← Précédent
        </span>
      )}

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Page <span className="font-semibold text-zinc-900 dark:text-zinc-100">{page}</span> sur{" "}
        {lastPage} · {total} produit{total > 1 ? "s" : ""}
      </p>

      {page < lastPage ? (
        <Link
          href={buildHref(routeParams, page + 1)}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Suivant →
        </Link>
      ) : (
        <span aria-hidden className="rounded-lg border border-zinc-200 px-4 py-2 text-sm text-zinc-300 dark:border-zinc-800 dark:text-zinc-700">
          Suivant →
        </span>
      )}
    </nav>
  );
}
