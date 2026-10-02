/**
 * Gestion produit côté vendeur — création, modification, consultation.
 *
 * Le vendor_id est injecté par l'action serveur (jamais par le client).
 * Le guard SQL `guard_product_transitions` protège les transitions de
 * statut et l'immutabilité de vendor_id.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { slugifyFr } from "@/lib/slug";
import { minorToDecimalString, parseAmountToMinor, ZERO_MINOR } from "@/lib/money";

export type ManageDb = Pick<SupabaseClient, "from">;

export interface SellerProduct {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: string;
  readonly price: string;
  readonly currency: string;
  readonly categoryId: string | null;
  readonly categoryName: string | null;
  readonly thumbnailUrl: string | null;
  readonly thumbnailPath: string | null;
  readonly shortDescription: string | null;
  readonly description: string | null;
  readonly hasFile: boolean;
  readonly createdAt: string;
  readonly rejectionReason?: string | null;
  readonly productType: string;
}

export interface CategoryItem {
  readonly id: string;
  readonly name: string;
  readonly slug: string;
}

type CategoryRelation = { id: string; name: string; slug: string } | null | undefined;

function categoryName(category: CategoryRelation | CategoryRelation[]): string | null {
  return (Array.isArray(category) ? category[0] : category)?.name ?? null;
}

const VALID_CURRENCIES = ["USD", "CDF"] as const;

export function checkProductCompletion(product: SellerProduct): boolean {
  let priceMinor: bigint;
  try {
    priceMinor = parseAmountToMinor(product.price, product.currency as "USD" | "CDF");
  } catch {
    return false;
  }
  const infosOk =
    !!product.title &&
    product.title.length >= 3 &&
    !!product.currency &&
    VALID_CURRENCIES.includes(product.currency as (typeof VALID_CURRENCIES)[number]) &&
    !!product.categoryId &&
    !!product.price &&
    priceMinor > ZERO_MINOR;
  if (!infosOk) return false;
  if (product.productType === "DIGITAL" || product.productType === "PHYSICAL") {
    if (!product.thumbnailPath) return false;
  }
  if (product.productType === "DIGITAL") {
    if (!product.hasFile) return false;
  }
  return true;
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
    productType?: string;
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
      product_type: input.productType ?? "PHYSICAL",
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
    productType?: string;
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
  if (input.productType !== undefined) {
    updateData.product_type = input.productType;
  }
  if (
    input.thumbnailUrl !== undefined &&
    input.thumbnailUrl !== null &&
    input.thumbnailUrl !== ""
  ) {
    updateData.thumbnail_url = input.thumbnailUrl;
  }
  if (
    input.thumbnailPath !== undefined &&
    input.thumbnailPath !== null &&
    input.thumbnailPath !== ""
  ) {
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
export async function listMyProducts(db: ManageDb, vendorId: string): Promise<SellerProduct[]> {
  const { data, error } = await db
    .from("products")
    .select(
      `
      id, title, slug, status, price, currency, category_id, product_type,
      category:categories(id, name, slug),
      thumbnail_url, thumbnail_path, short_description, description, created_at, rejection_reason
    `,
    )
    .eq("vendor_id", vendorId)
    .order("created_at", { ascending: false });

  if (error !== null) {
    throw new Error(`Lecture des produits impossible : ${error.message}`);
  }

  const productIds = (data ?? []).map((row) => row.id);

  const fileCounts: Record<string, number> = {};
  if (productIds.length > 0) {
    const { data: fileRows } = await db
      .from("product_files")
      .select("product_id")
      .in("product_id", productIds);
    for (const fileRow of fileRows ?? []) {
      const key = fileRow.product_id as string;
      fileCounts[key] = (fileCounts[key] ?? 0) + 1;
    }
  }

  return (data ?? []).map(
    (row: {
      id: string;
      title: string;
      slug: string;
      status: string;
      price: string;
      currency: string;
      category_id: string | null;
      product_type: string;
      category: CategoryRelation[];
      thumbnail_url: string | null;
      thumbnail_path: string | null;
      short_description: string | null;
      description: string | null;
      created_at: string;
      rejection_reason: string | null;
    }) => ({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      price: String(row.price),
      currency: row.currency,
      categoryId: row.category_id,
      categoryName: categoryName(row.category),
      thumbnailUrl: row.thumbnail_url,
      thumbnailPath: row.thumbnail_path,
      shortDescription: row.short_description,
      description: row.description,
      hasFile: (fileCounts[row.id] ?? 0) > 0,
      createdAt: row.created_at,
      rejectionReason: row.rejection_reason,
      productType: row.product_type ?? "PHYSICAL",
    }),
  );
}

/** Récupère un produit du vendeur connecté, ou null. */
export async function getMyProduct(
  db: ManageDb,
  productId: string,
  vendorId: string,
): Promise<SellerProduct | null> {
  const { data, error } = await db
    .from("products")
    .select(
      `
      id, title, slug, status, price, currency, category_id, product_type,
      category:categories(id, name, slug),
      thumbnail_url, thumbnail_path, short_description, description, created_at, rejection_reason
    `,
    )
    .eq("id", productId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`Lecture produit impossible : ${error.message}`);
  }

  if (data === null) return null;

  const row = data as {
    id: string;
    title: string;
    slug: string;
    status: string;
    price: string;
    currency: string;
    category_id: string | null;
    product_type: string;
    category: CategoryRelation[];
    thumbnail_url: string | null;
    thumbnail_path: string | null;
    short_description: string | null;
    description: string | null;
    created_at: string;
    rejection_reason: string | null;
  };

  const { data: latestFile } = await db
    .from("product_files")
    .select("id")
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    status: row.status,
    price: String(row.price),
    currency: row.currency,
    categoryId: row.category_id,
    categoryName: categoryName(row.category),
    thumbnailUrl: row.thumbnail_url,
    thumbnailPath: row.thumbnail_path,
    shortDescription: row.short_description,
    description: row.description,
    hasFile: latestFile !== null,
    createdAt: row.created_at,
    rejectionReason: row.rejection_reason,
    productType: row.product_type ?? "PHYSICAL",
  };
}

/** Met à jour le statut d'un produit (vendeur → PENDING_REVIEW depuis DRAFT ou REJECTED). */
export async function updateProductStatus(
  db: ManageDb,
  productId: string,
  vendorId: string,
): Promise<ProductResult> {
  const { data: product, error: productError } = await db
    .from("products")
    .select("id, status, thumbnail_path, product_type")
    .eq("id", productId)
    .eq("vendor_id", vendorId)
    .maybeSingle();

  if (productError !== null) {
    return { ok: false, error: friendlyProductError(productError.message) };
  }
  if (product === null) {
    return { ok: false, error: "Produit introuvable ou accès refusé." };
  }

  if (product.status === "PUBLISHED") {
    return { ok: false, error: "Ce produit est déjà publié." };
  }

  if (product.status === "ARCHIVED") {
    return { ok: false, error: "Ce produit est archivé." };
  }

  if (product.status === "PENDING_REVIEW") {
    return { ok: true, productId: product.id };
  }

  if (product.status !== "DRAFT" && product.status !== "REJECTED") {
    return { ok: false, error: "Ce produit ne peut pas être soumis depuis son statut actuel." };
  }

  const missing: string[] = [];
  const productType = (product as { product_type: string }).product_type;
  if (!product.thumbnail_path && (productType === "DIGITAL" || productType === "PHYSICAL")) {
    missing.push("une image de couverture");
  }
  if (productType === "DIGITAL") {
    const { count } = await db
      .from("product_files")
      .select("id", { count: "exact" })
      .eq("product_id", productId)
      .maybeSingle();
    if (count === null || count === 0) missing.push("un fichier numérique");
  }

  if (missing.length > 0) {
    return { ok: false, error: `Il manque encore : ${missing.join(" • ")}.` };
  }

  const { data, error } = await db
    .from("products")
    .update({ status: "PENDING_REVIEW" })
    .eq("id", productId)
    .eq("vendor_id", vendorId)
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

export { listProductFiles } from "@/services/products/product-files";
