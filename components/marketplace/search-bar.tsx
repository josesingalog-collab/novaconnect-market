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
      className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950 sm:flex-row sm:items-center"
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
        className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
      />
      <select
        name="tri"
        defaultValue={params.tri ?? "recent"}
        aria-label="Trier les produits"
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Filtrer
      </button>
      {hasFilters && (
        <a
          href="/catalogue"
          className="text-center text-sm font-medium text-zinc-500 underline-offset-4 hover:underline dark:text-zinc-400"
        >
          Réinitialiser
        </a>
      )}
    </form>
  );
}
