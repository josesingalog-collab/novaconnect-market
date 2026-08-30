/**
 * Gestion produit côté vendeur — création, modification, consultation.
 *
 * Le vendor_id est injecté par l'action serveur (jamais par le client).
 * Le guard SQL `guard_product_transitions` protège les transitions de
 * statut et l'immutabilité de vendor_id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyFr } from "@/lib/slug";
import { minorToDecimalString, parseAmountToMinor } from "@/lib/money";

export type ManageDb = Pick<SupabaseClient, "from">;

export interface SellerProduct {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: string;
  readonly price: string;
  readonly currency: string;
  readonly categoryId: string;
  readonly categoryName: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailPath: string | null;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly createdAt: string;
}

export interface CategoryItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

export type ProductResult =
  | { readonly ok: true; readonly productId: string }
  | { readonly ok: false; readonly error: string };

function friendlyProductError(message: string): string {
  if (/duplicate key|unique constraint/i.test(message)) {
    return "Un produit avec ce slug existe déjà. Essaie un autre titre.";
  }
  if (/vendor_id immuable/i.test(message)) {
    return "Impossible de modifier le vendeur de ce produit.";
  }
  if (/Produit non autorise/i.test(message)) {
    return "Ce produit ne t'appartient pas.";
  }
  if (/Seule l'administration/i.test(message)) {
    return "Seule l'administration peut effectuer cette action.";
  }
  if (/Transition de statut/i.test(message)) {
    return "Transition de statut non autorisée.";
  }
  if (/Contenu fige/i.test(message)) {
    return "Ce produit est en validation ou publié : seul le statut peut changer.";
  }
  if (/prix/i.test(message) || /invalid/i.test(message)) {
    return "Le prix est invalide.";
  }
  return "Une erreur est survenue. Réessaie dans un instant.";
}

async function generateUniqueSlug(
  db: ManageDb,
  title: string,
  excludeId?: string,
): Promise<string> {
  const base = slugifyFr(title);
  if (base.length === 0) return `produit-${Date.now()}`;

  let slug = base;
  let counter = 0;

  while (true) {
    let query = db.from("products").select("id").eq("slug", slug);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query.maybeSingle();
    if (data === null) break;
    slug = `${base}-${++counter}`;
    if (counter > 20) slug = `${base}-${Date.now()}`;
  }

  return slug;
}

/**
 * Crée un produit en DRAFT. Le vendor_id est fourni par l'action
 * serveur (jamais par le client).
 */
export async function createProduct(
  db: ManageDb,
  vendorId: string,
  input: {
    title: string;
    shortDescription?: string | null;
    description?: string | null;
    price: string;
    currency: string;
    categoryId: string;
    thumbnailUrl?: string | null;
    thumbnailPath?: string | null;
  },
): Promise<ProductResult> {
  let priceMinor: bigint;
  try {
    priceMinor = parseAmountToMinor(input.price, input.currency as "USD" | "CDF");
  } catch {
    return { ok: false, error: "Le prix est invalide." };
  }
  const normalizedPrice = minorToDecimalString(priceMinor, input.currency as "USD" | "CDF");

  const slug = await generateUniqueSlug(db, input.title);

  const { data, error } = await db
    .from("products")
    .insert({
      vendor_id: vendorId,
      category_id: input.categoryId,
      title: input.title,
      slug,
      short_description: input.shortDescription || null,
      description: input.description || null,
      price: normalizedPrice,
      currency: input.currency,
      thumbnail_url: input.thumbnailUrl || null,
      thumbnail_path: input.thumbnailPath || null,
      status: "DRAFT",
    })
    .select("id")
    .single();

  if (error !== null) {
    return { ok: false, error: friendlyProductError(error.message) };
  }
  if (data === null) {
    return { ok: false, error: "Impossible de créer le produit." };
  }

  return { ok: true, productId: data.id };
}

/**
 * Met à jour un produit. Le guard SQL valide les transitions et
 * l'immutabilité de vendor_id. RLS vérifie la propriété.
 */
export async function updateProduct(
  db: ManageDb,
  productId: string,
  input: {
    title: string;
    shortDescription?: string | null;
    description?: string | null;
    price: string;
    currency: string;
    categoryId: string;
    thumbnailUrl?: string | null;
    thumbnailPath?: string | null;
  },
): Promise<ProductResult> {
  let priceMinor: bigint;
  try {
    priceMinor = parseAmountToMinor(input.price, input.currency as "USD" | "CDF");
  } catch {
    return { ok: false, error: "Le prix est invalide." };
  }
  const normalizedPrice = minorToDecimalString(priceMinor, input.currency as "USD" | "CDF");

  const slug = await generateUniqueSlug(db, input.title, productId);

  const updateData: Record<string, unknown> = {
    title: input.title,
    slug,
    short_description: input.shortDescription || null,
    description: input.description || null,
    price: normalizedPrice,
    currency: input.currency,
    category_id: input.categoryId,
  };
  if (input.thumbnailUrl !== undefined && input.thumbnailUrl !== null && input.thumbnailUrl !== "") {
    updateData.thumbnail_url = input.thumbnailUrl;
  }
  if (input.thumbnailPath !== undefined && input.thumbnailPath !== null && input.thumbnailPath !== "") {
    updateData.thumbnail_path = input.thumbnailPath;
  }

  const { data, error } = await db
    .from("products")
    .update(updateData)
    .eq("id", productId)
    .select("id")
    .single();

  if (error !== null) {
    return { ok: false, error: friendlyProductError(error.message) };
  }
  if (data === null) {
    return { ok: false, error: "Produit introuvable ou accès refusé." };
  }

  return { ok: true, productId: data.id };
}

/** Liste les produits du vendeur connecté. */
export async function listMyProducts(
  db: ManageDb,
  vendorId: string,
): Promise<SellerProduct[]> {
  const { data, error } = await db
    .from("products")
    .select("id, title, slug, status, price, currency, category_id, thumbnail_url, thumbnail_path, short_description, description, created_at")
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error !== null) {
    throw new Error(`Lecture des produits impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    price: String(row.price),
    currency: row.currency,
    categoryId: row.category_id,
    categoryName: null,
    thumbnailUrl: row.thumbnail_url,
    thumbnailPath: row.thumbnail_path,
    shortDescription: row.short_description,
    description: row.description,
    createdAt: row.created_at,
  }));
}

/** Récupère un produit du vendeur connecté, ou null. */
export async function getMyProduct(
  db: ManageDb,
  productId: string,
  vendorId: string,
): Promise<SellerProduct | null> {
  const { data, error } = await db
    .from("products")
    .select("id, title, slug, status, price, currency, category_id, thumbnail_url, thumbnail_path, short_description, description, created_at")
    .eq("id", productId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`Lecture produit impossible : ${error.message}`);
  }

  if (data === null) return null;

  return {
    id: data.id,
    title: data.title,
    slug: data.slug,
    status: data.status,
    price: String(data.price),
    currency: data.currency,
    categoryId: data.category_id,
    categoryName: null,
    thumbnailUrl: data.thumbnail_url,
    thumbnailPath: data.thumbnail_path,
    shortDescription: data.short_description,
    description: data.description,
    createdAt: data.created_at,
  };
}

/** Catégories actives pour le formulaire. */
export async function listCategories(db: ManageDb): Promise<CategoryItem[]> {
  const { data, error } = await db
    .from("categories")
    .select("id, name, slug")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error !== null) {
    throw new Error(`Lecture des catégories impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }));
}