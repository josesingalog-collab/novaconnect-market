/**
 * Image de couverture — GET /api/products/[productId]/cover
 *                           POST /api/products/[productId]/cover
 *
 * GET  : Retourne une signed URL temporaire pour l'image de couverture
 *        depuis le bucket privé `product-files`.
 * POST : Upload d'une image de couverture (JPG/PNG/WebP, max 5 Mo).
 *
 * Le bucket reste PRIVÉ : aucun client ne peut forger d'URL.
 * Le serveur vérifie la propriété via RLS (vendors.user_id = auth.uid()
 * ou admin), puis génère la signed URL ou upload côté service_role.
 */
import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStorageBucketProductFiles } from "@/lib/env";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COVER_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_SIGNED_URL_TTL_SECONDS = 60;

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

function hasExpectedImageSignature(file: File, bytes: Uint8Array): boolean {
  if (file.type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }

  if (file.type === "image/png") {
    return (
      bytes.length >= 8 &&
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }

  return (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
}

async function getProductOwner(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  productId: string,
): Promise<{ vendorId: string; userId: string; productStatus: string } | null> {
  const { data: product } = await supabase
    .from("products")
    .select("vendor_id, status")
    .eq("id", productId)
    .single();
  if (!product) return null;
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id, user_id")
    .eq("id", product.vendor_id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (!vendor) return null;
  return { vendorId: vendor.id, userId: vendor.user_id, productStatus: product.status };
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const { productId } = await context.params;
  if (!UUID_PATTERN.test(productId)) {
    return json(404, { error: "Produit introuvable" });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return json(401, { error: "Connexion requise" });
  }
  const { data: product, error } = await supabase
    .from("products")
    .select("thumbnail_path, vendor_id, status")
    .eq("id", productId)
    .single();
  if (error !== null || product === null) {
    return json(404, { error: "Produit introuvable" });
  }

  const owner = await getProductOwner(supabase, productId);
  if (!owner) {
    return json(404, { error: "Vendeur introuvable" });
  }

  const isOwner = owner.userId === user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "ADMIN" && profile.status === "ACTIVE";
  if (!isOwner && !isAdmin) {
    return json(403, { error: "Accès refusé" });
  }
  const thumbnailPath = product.thumbnail_path;
  if (!thumbnailPath) {
    return json(404, { error: "Image de couverture absente" });
  }

  const admin = createSupabaseAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(getStorageBucketProductFiles())
    .createSignedUrl(thumbnailPath, COVER_SIGNED_URL_TTL_SECONDS);
  if (signError !== null || signed === null) {
    return json(500, { error: "Génération du lien impossible." });
  }

  return json(200, {
    ok: true,
    thumbnailUrl: signed.signedUrl,
    expiresAt: new Date(Date.now() + COVER_SIGNED_URL_TTL_SECONDS * 1000).toISOString(),
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const { productId } = await context.params;
  if (!UUID_PATTERN.test(productId)) {
    return json(404, { error: "Produit introuvable" });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return json(401, { error: "Connexion requise" });
  }
  if (await requiresMfaChallenge(supabase)) {
    return json(403, { error: "Vérification en deux étapes requise." });
  }
  const owner = await getProductOwner(supabase, productId);
  if (!owner) {
    return json(404, { error: "Vendeur introuvable" });
  }

  const isOwner = owner.userId === user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "ADMIN" && profile.status === "ACTIVE";
  if (!isOwner && !isAdmin) {
    return json(403, { error: "Accès refusé" });
  }
  if (!isAdmin && !["DRAFT", "REJECTED", "PUBLISHED"].includes(owner.productStatus)) {
    return json(409, { error: "La couverture ne peut pas être modifiée dans cet état." });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return json(400, { error: "Fichier requis." });
  }

  if (
    !COVER_ALLOWED_MIME_TYPES.includes(
      file.type as unknown as (typeof COVER_ALLOWED_MIME_TYPES)[number],
    )
  ) {
    return json(400, { error: "Format non autorisé. JPG, PNG ou WebP uniquement." });
  }

  if (file.size === 0 || file.size > COVER_MAX_BYTES) {
    return json(400, {
      error: `Image trop volumineuse (max ${COVER_MAX_BYTES / 1024 / 1024} Mo).`,
    });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!hasExpectedImageSignature(file, bytes)) {
    return json(400, { error: "Le contenu du fichier ne correspond pas au format image annoncé." });
  }

  const ext = file.type === "image/jpeg" ? ".jpg" : file.type === "image/png" ? ".png" : ".webp";
  const uuid = crypto.randomUUID();
  const thumbnailPath = `${owner.userId}/products/${productId}/cover/${uuid}${ext}`;

  const admin = createSupabaseAdminClient();
  const { data: uploadData, error: uploadError } = await admin.storage
    .from(getStorageBucketProductFiles())
    .upload(thumbnailPath, file, { contentType: file.type, upsert: false });

  if (uploadError !== null || uploadData === null) {
    return json(500, { error: "Erreur upload image de couverture." });
  }

  const { data: updated, error: updateError } = await supabase
    .from("products")
    .update({ thumbnail_path: thumbnailPath })
    .eq("id", productId)
    .select("id")
    .single();

  if (updateError !== null || updated === null) {
    await admin.storage.from(getStorageBucketProductFiles()).remove([thumbnailPath]);
    return json(500, { error: "Impossible d'enregistrer l'image de couverture." });
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);

  return json(200, { ok: true });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const { productId } = await context.params;
  if (!UUID_PATTERN.test(productId)) {
    return json(404, { error: "Produit introuvable" });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return json(401, { error: "Connexion requise" });
  }
  if (await requiresMfaChallenge(supabase)) {
    return json(403, { error: "Vérification en deux étapes requise." });
  }

  const owner = await getProductOwner(supabase, productId);
  if (!owner) {
    return json(404, { error: "Vendeur introuvable" });
  }

  const isOwner = owner.userId === user.id;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .maybeSingle();
  const isAdmin = profile?.role === "ADMIN" && profile.status === "ACTIVE";
  if (!isOwner && !isAdmin) {
    return json(403, { error: "Accès refusé" });
  }
  if (!isAdmin && !["DRAFT", "REJECTED", "PUBLISHED"].includes(owner.productStatus)) {
    return json(409, { error: "La couverture ne peut pas être modifiée dans cet état." });
  }

  const { data: product } = await supabase
    .from("products")
    .select("thumbnail_path")
    .eq("id", productId)
    .maybeSingle();
  if (!product?.thumbnail_path) {
    return json(404, { error: "Image de couverture absente" });
  }

  const { data: updated, error: updateError } = await supabase
    .from("products")
    .update({ thumbnail_path: null })
    .eq("id", productId)
    .select("id")
    .maybeSingle();
  if (updateError !== null || updated === null) {
    return json(500, { error: "Impossible de supprimer l'image de couverture." });
  }

  const admin = createSupabaseAdminClient();
  const { error: removeError } = await admin.storage
    .from(getStorageBucketProductFiles())
    .remove([product.thumbnail_path]);
  if (removeError !== null) {
    return json(500, { error: "Image dissociée, mais sa suppression du stockage a échoué." });
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);
  return json(200, { ok: true });
}
