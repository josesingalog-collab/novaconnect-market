import { Button } from "@/components/ui/button";

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
export function SearchBar({ params }: { params: SearchBarParams }) {
  const hasFilters =
    (params.q !== undefined && params.q.length > 0) ||
    (params.tri !== undefined && params.tri !== "recent");

  return (
    <form
      method="get"
      action="/catalogue"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center"
    >
      {params.categorie !== undefined && (
        <input type="hidden" name="categorie" value={params.categorie} />
      )}
      <input
        type="search"
        name="q"
        defaultValue={params.q ?? ""}
        placeholder="Rechercher un produit…"
        aria-label="Rechercher un produit par titre"
        className="border-input flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 dark:border-border dark:bg-card dark:text-foreground dark:focus:border-ring"
      />
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
      <Button type="submit" size="sm" className="min-h-[48px]">
        Filtrer
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
