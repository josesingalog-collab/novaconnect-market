import { Button } from "@/components/ui/button";
import type { PublicCategory } from "@/services/products/public";

export interface SearchBarParams {
  q?: string;
  tri?: string;
  categorie?: string;
}

const SORT_OPTIONS = [
  { value: "recent", label: "Plus récents" },
  { value: "price_asc", label: "Prix croissant" },
  { value: "price_desc", label: "Prix décroissant" },
] as const;

/** Filtres du catalogue : formulaire GET natif, zéro JavaScript client. */
export function SearchBar({
  params,
  categories,
}: {
  params: SearchBarParams;
  categories: PublicCategory[];
}) {
  const hasFilters =
    (params.q !== undefined && params.q.length > 0) ||
    (params.tri !== undefined && params.tri !== "recent") ||
    params.categorie !== undefined;

  return (
    <form
      method="get"
      action="/catalogue"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:flex-row lg:items-center"
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
          defaultValue={params.q ?? ""}
          placeholder="Rechercher un produit…"
          aria-label="Rechercher un produit par titre"
          className="border-input w-full rounded-lg border bg-background py-2.5 pr-3 pl-10 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 dark:border-border dark:bg-card dark:text-foreground dark:focus:border-ring"
        />
      </div>
      <select
        name="categorie"
        defaultValue={params.categorie ?? ""}
        aria-label="Filtrer par catégorie"
        className="border-input rounded-lg border bg-background px-3 py-2.5 text-sm outline-none dark:border-border dark:bg-card dark:text-foreground"
      >
          <option value="">Toutes les catégories</option>
        {categories.map((category) => (
          <option key={category.id} value={category.slug}>
            {category.name}
          </option>
        ))}
      </select>
      <select
        name="tri"
        defaultValue={params.tri ?? "recent"}
        aria-label="Trier les produits"
        className="border-input rounded-lg border bg-background px-3 py-2.5 text-sm outline-none dark:border-border dark:bg-card dark:text-foreground"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" size="sm" className="min-h-[48px] gap-2 px-4">
        <svg
          className="h-4 w-4"
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
        Rechercher
      </Button>
      {hasFilters && (
        <a
          href="/catalogue"
          className="text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
        >
          Réinitialiser
        </a>
      )}
    </form>
  );
}
