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

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COVER_ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const COVER_MAX_BYTES = 5 * 1024 * 1024;
const COVER_SIGNED_URL_TTL_SECONDS = 60;

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

async function getProductOwner(supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>, productId: string): Promise<{ vendorId: string; userId: string } | null> {
  const { data: product } = await supabase.from("products").select("vendor_id").eq("id", productId).single();
  if (!product) return null;
  const { data: vendor } = await supabase.from("vendors").select("id, user_id").eq("id", product.vendor_id).eq("status", "ACTIVE").maybeSingle();
  if (!vendor) return null;
  return { vendorId: vendor.id, userId: vendor.user_id };
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
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) {
    return json(401, { error: "Connexion requise" });
  }

  const { data: product, error } = await supabase.from("products").select("thumbnail_path, vendor_id, status").eq("id", productId).single();
  if (error !== null || product === null) {
    return json(404, { error: "Produit introuvable" });
  }

  const owner = await getProductOwner(supabase, productId);
  if (!owner) {
    return json(404, { error: "Vendeur introuvable" });
  }

  const isOwner = owner.userId === user.id;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return json(403, { error: "Accès refusé" });
  }

  const thumbnailPath = product.thumbnail_path;
  if (!thumbnailPath) {
    return json(404, { error: "Image de couverture absente" });
  }

  const admin = createSupabaseAdminClient();
  const { data: signed, error: signError } = await admin.storage.from(getStorageBucketProductFiles()).createSignedUrl(thumbnailPath, COVER_SIGNED_URL_TTL_SECONDS);
  if (signError !== null || signed === null) {
    return json(500, { error: "Génération du lien impossible." });
  }

  return json(200, { ok: true, thumbnailUrl: signed.signedUrl, expiresAt: new Date(Date.now() + COVER_SIGNED_URL_TTL_SECONDS * 1000).toISOString() });
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
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) {
    return json(401, { error: "Connexion requise" });
  }

  const owner = await getProductOwner(supabase, productId);
  if (!owner) {
    return json(404, { error: "Vendeur introuvable" });
  }

  const isOwner = owner.userId === user.id;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return json(403, { error: "Accès refusé" });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return json(400, { error: "Fichier requis." });
  }

  if (!COVER_ALLOWED_MIME_TYPES.includes(file.type as unknown as typeof COVER_ALLOWED_MIME_TYPES[number])) {
    return json(400, { error: "Format non autorisé. JPG, PNG ou WebP uniquement." });
  }

  if (file.size === 0 || file.size > COVER_MAX_BYTES) {
    return json(400, { error: `Image trop volumineuse (max ${COVER_MAX_BYTES / 1024 / 1024} Mo).` });
  }

  const ext = file.type === "image/jpeg" ? ".jpg" : file.type === "image/png" ? ".png" : ".webp";
  const uuid = crypto.randomUUID();
  const thumbnailPath = `${owner.userId}/products/${productId}/cover/${uuid}${ext}`;

  const admin = createSupabaseAdminClient();
  const { data: uploadData, error: uploadError } = await admin.storage.from(getStorageBucketProductFiles()).upload(thumbnailPath, file, { contentType: file.type, upsert: false });

  if (uploadError !== null || uploadData === null) {
    return json(500, { error: "Erreur upload image de couverture." });
  }

  const { data: updated, error: updateError } = await supabase.from("products").update({ thumbnail_path: thumbnailPath }).eq("id", productId).select("id").single();

  if (updateError !== null || updated === null) {
    return json(500, { error: "Impossible d'enregistrer l'image de couverture." });
  }

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
  const { data: { user } } = await supabase.auth.getUser();
  if (user === null) {
    return json(401, { error: "Connexion requise" });
  }

  const owner = await getProductOwner(supabase, productId);
  if (!owner) {
    return json(404, { error: "Vendeur introuvable" });
  }

  const isOwner = owner.userId === user.id;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const isAdmin = profile?.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return json(403, { error: "Accès refusé" });
  }

  const { data: product } = await supabase.from("products").select("thumbnail_path").eq("id", productId).maybeSingle();
  if (!product?.thumbnail_path) {
    return json(404, { error: "Image de couverture absente" });
  }

  const admin = createSupabaseAdminClient();
  await admin.storage.from(getStorageBucketProductFiles()).remove([product.thumbnail_path]).catch(() => {});
  try {
    await supabase.from("products").update({ thumbnail_path: null }).eq("id", productId);
  } catch {
    // ignore
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);
  return json(200, { ok: true });
}