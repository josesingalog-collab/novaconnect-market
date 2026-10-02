/**
 * Fichiers produits — opérations côté vendeur.
 *
 * Le contenu vit dans le bucket Storage privé `product-files`.
 * Les métadonnées vivent dans la table `product_files`.
 * Le remplacement crée une nouvelle version (version +1),
 * l'ancien fichier reste orphelin dans le bucket (V1).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getStorageBucketProductFiles } from "@/lib/env";
import { productFileSchema, MAX_FILE_SIZE, ALLOWED_MIME_TYPES } from "@/schemas/product-file";

export type ProductFilesDb = Pick<SupabaseClient, "from" | "storage">;

export interface ProductFileRow {
  readonly id: string;
  readonly product_id: string;
  readonly storage_path: string;
  readonly file_name: string;
  readonly file_size_bytes: bigint;
  readonly mime_type: string;
  readonly version: number;
  readonly created_at: string;
}

export type UploadResult = { ok: true; productFile: ProductFileRow } | { ok: false; error: string };

function mimeTypeToExt(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "application/pdf": ".pdf",
    "application/zip": ".zip",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "application/msword": ".doc",
    "text/plain": ".txt",
    "text/csv": ".csv",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  };
  return map[mime] ?? ".bin";
}

function generateStoragePath(userId: string, productId: string, ext: string): string {
  const uuid = crypto.randomUUID();
  return `${userId}/products/${productId}/${uuid}${ext}`;
}

async function isProductOwner(
  db: ProductFilesDb,
  userId: string,
  productId: string,
): Promise<boolean> {
  const { data: vendor } = await db
    .from("vendors")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (vendor === null || vendor === undefined) return false;

  const { data } = await db
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("vendor_id", (vendor as { id: string }).id)
    .maybeSingle();

  return data !== null && data !== undefined;
}

async function currentVersion(db: ProductFilesDb, productId: string): Promise<number> {
  const { data, error } = await db
    .from("product_files")
    .select("version")
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(1)
    .single();

  if (error !== null || data === null) return 0;
  return (data as { version: number }).version;
}

export async function uploadProductFile(
  db: ProductFilesDb,
  userId: string,
  productId: string,
  file: File,
): Promise<UploadResult> {
  const parsed = productFileSchema.safeParse({ productId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Produit invalide." };
  }

  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    return { ok: false, error: `Fichier trop volumineux (max ${MAX_FILE_SIZE / 1024 / 1024} Mo).` };
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as unknown as (typeof ALLOWED_MIME_TYPES)[number])) {
    return { ok: false, error: `Type MIME "${file.type}" non autorise.` };
  }

  const owner = await isProductOwner(db, userId, productId);
  if (!owner) {
    return { ok: false, error: "Produit non autorise." };
  }

  const ext = mimeTypeToExt(file.type);
  const storagePath = generateStoragePath(userId, productId, ext);

  const { data: uploadData, error: uploadError } = await db.storage
    .from(getStorageBucketProductFiles())
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError !== null || uploadData === null) {
    return { ok: false, error: "Erreur upload Storage." };
  }

  const ver = await currentVersion(db, productId);
  const newVersion = ver + 1;

  const { data, error } = await db
    .from("product_files")
    .insert({
      product_id: productId,
      storage_path: storagePath,
      file_name: file.name,
      file_size_bytes: BigInt(file.size),
      mime_type: file.type,
      version: newVersion,
    })
    .select(
      "id, product_id, storage_path, file_name, file_size_bytes, mime_type, version, created_at",
    )
    .single();

  if (error !== null || data === null) {
    return { ok: false, error: "Impossible d'enregistrer les métadonnées du fichier." };
  }

  const row = data as unknown as ProductFileRow;
  return { ok: true, productFile: row };
}

export async function listProductFiles(
  db: ProductFilesDb,
  productId: string,
): Promise<ProductFileRow[]> {
  const { data, error } = await db
    .from("product_files")
    .select(
      "id, product_id, storage_path, file_name, file_size_bytes, mime_type, version, created_at",
    )
    .eq("product_id", productId)
    .order("created_at", { ascending: false });

  if (error !== null) return [];
  return (data ?? []) as ProductFileRow[];
}
