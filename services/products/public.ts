/**
 * Lectures PUBLIQUES du catalogue — aucune écriture, aucun privilège élevé.
 *
 * Le client Supabase est INJECTÉ par l'appelant :
 *  - pages serveur → `await createSupabaseServerClient()` (clé anon + cookies) ;
 *  - tests d'intégration → client anon brut.
 * Dans tous les cas la RLS PostgreSQL filtre réellement : produits PUBLISHED de
 * vendeurs ACTIVE, catégories actives, vitrines ACTIVE uniquement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Client minimal requis : uniquement `from` (lecture tables publiques). */
export type PublicDb = Pick<SupabaseClient, "from">;

export const MAX_PAGE_SIZE = 24;

export type ProductSort = "recent" | "price_asc" | "price_desc";

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  /** Description longue — présente uniquement via getPublicProductBySlug. */
  description: string | null;
  thumbnailUrl: string | null;
  /** Chemin Storage privé de l'image de couverture. Ne jamais exposer directement. */
  thumbnailPath: string | null;
  /** Montant en decimal string (D-001) ; PostgREST peut sérialiser en nombre (D-016). */
  price: string;
  currency: string;
  publishedAt: string;
  categoryName: string | null;
  categorySlug: string | null;
  storeName: string;
  storeSlug: string;
}

export interface PublicProductPage {
  products: PublicProduct[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
}

export interface PublicVendor {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
}

const PRODUCT_COLUMNS = `
  id, slug, title, short_description, thumbnail_url, thumbnail_path, price, currency, published_at,
  category:categories ( name, slug ),
  vendor:vendors ( store_name, slug )
`;

interface ProductRow {
  id: string;
  slug: string;
  title: string;
  short_description: string | null;
  /** Renseigné uniquement par la requête de détail. */
  description?: string | null;
  thumbnail_url: string | null;
  thumbnail_path: string | null;
  price: string | number;
  currency: string;
  published_at: string;
  category: { name: string; slug: string } | null;
  vendor: { store_name: string; slug: string } | null;
}

function toPublicProduct(row: ProductRow): PublicProduct {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description ?? null,
    thumbnailUrl: row.thumbnail_url,
    thumbnailPath: row.thumbnail_path,
    price: String(row.price),
    currency: row.currency,
    publishedAt: row.published_at,
    categoryName: row.category?.name ?? null,
    categorySlug: row.category?.slug ?? null,
    storeName: row.vendor?.store_name ?? "",
    storeSlug: row.vendor?.slug ?? "",
  };
}

function normalizeSearchTerm(term: string): string {
  // Neutralise les jokers LIKE saisis par l'utilisateur (% _ \).
  return term.trim().replace(/([%_\\])/g, "\\$1");
}

/**
 * Liste paginée des produits publisibles (PUBLISHED + vendeur ACTIVE, via RLS).
 * Taille de page fixe et plafonnée à MAX_PAGE_SIZE ; `page` bornée ≥ 1.
 */
export async function listPublicProducts(
  db: PublicDb,
  params: {
    page?: number;
    categoryId?: string;
    vendorId?: string;
    search?: string;
    sort?: ProductSort;
  } = {},
): Promise<PublicProductPage> {
  const pageSize = MAX_PAGE_SIZE;
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const from = (page - 1) * pageSize;

  // Au-delà de la première page : pré-comptage léger (mêmes filtres) pour
  // éviter l'erreur PostgREST « Requested range not satisfiable ».
  let total = 0;
  if (from > 0) {
    let countQuery = db
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("status", "PUBLISHED");
    if (params.categoryId !== undefined && params.categoryId.length > 0) {
      countQuery = countQuery.eq("category_id", params.categoryId);
    }
    if (params.vendorId !== undefined && params.vendorId.length > 0) {
      countQuery = countQuery.eq("vendor_id", params.vendorId);
    }
    if (params.search !== undefined && params.search.trim().length > 0) {
      countQuery = countQuery.ilike("title", `%${normalizeSearchTerm(params.search)}%`);
    }
    const { count, error: countError } = await countQuery;
    if (countError !== null) {
      throw new Error(`Lecture du catalogue impossible : ${countError.message}`);
    }
    total = count ?? 0;
    if (from >= total) {
      return { products: [], total, page, pageSize };
    }
  }

  let query = db
    .from("products")
    .select(PRODUCT_COLUMNS, from > 0 ? undefined : { count: "exact" })
    .eq("status", "PUBLISHED");

  if (params.categoryId !== undefined && params.categoryId.length > 0) {
    query = query.eq("category_id", params.categoryId);
  }
  if (params.vendorId !== undefined && params.vendorId.length > 0) {
    query = query.eq("vendor_id", params.vendorId);
  }
  if (params.search !== undefined && params.search.trim().length > 0) {
    query = query.ilike("title", `%${normalizeSearchTerm(params.search)}%`);
  }

  const sort = params.sort ?? "recent";
  const sorted =
    sort === "price_asc"
      ? query.order("price", { ascending: true })
      : sort === "price_desc"
        ? query.order("price", { ascending: false })
        : query.order("published_at", { ascending: false });

  const { data, error, count } = await sorted
    .range(from, from + pageSize - 1)
    .returns<ProductRow[]>();

  if (error !== null) {
    throw new Error(`Lecture du catalogue impossible : ${error.message}`);
  }

  return {
    products: (data ?? []).map(toPublicProduct),
    total: from > 0 ? total : (count ?? 0),
    page,
    pageSize,
  };
}

/** Fiche produit publique par slug (null si absente ou non publie). */
export async function getPublicProductBySlug(
  db: PublicDb,
  slug: string,
): Promise<PublicProduct | null> {
  const { data, error } = await db
    .from("products")
    .select(`${PRODUCT_COLUMNS}, description`)
    .eq("status", "PUBLISHED")
    .eq("slug", slug)
    .maybeSingle<ProductRow>();

  if (error !== null) {
    throw new Error(`Lecture produit impossible : ${error.message}`);
  }

  return data === null ? null : toPublicProduct(data);
}

/** Catégories visibles publiquement (is_active, triées). */
export async function listPublicCategories(db: PublicDb): Promise<PublicCategory[]> {
  const { data, error } = await db
    .from("categories")
    .select("id, name, slug")
    .order("sort_order", { ascending: true });

  if (error !== null) {
    throw new Error(`Lecture catégories impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => ({ id: row.id, name: row.name, slug: row.slug }));
}

/** Vitrine publique par slug (null si vendeur non ACTIVE). */
export async function getPublicVendorBySlug(
  db: PublicDb,
  slug: string,
): Promise<PublicVendor | null> {
  const { data, error } = await db
    .from("vendors")
    .select("id, store_name, slug, description, logo_url")
    .eq("slug", slug)
    .maybeSingle<{ id: string; store_name: string; slug: string; description: string | null; logo_url: string | null }>();

  if (error !== null) {
    throw new Error(`Lecture boutique impossible : ${error.message}`);
  }

  return data === null
    ? null
    : {
        id: data.id,
        storeName: data.store_name,
        slug: data.slug,
        description: data.description,
        logoUrl: data.logo_url,
      };
}
