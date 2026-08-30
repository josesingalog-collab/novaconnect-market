"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStorageBucketProductFiles } from "@/lib/env";
import { productFormSchema } from "@/schemas/product-form";
import { createProduct, updateProduct } from "@/services/products/manage";
import { type ProductFormState } from "@/lib/product-form-state";

function toStr(value: FormDataEntryValue | null): string {
  if (value === null) return "";
  return typeof value === "string" ? value : "";
}

function parseForm(formData: FormData, extra?: Record<string, string>) {
  const raw: Record<string, string> = {
    title: toStr(formData.get("title")),
    shortDescription: toStr(formData.get("shortDescription")),
    description: toStr(formData.get("description")),
    price: toStr(formData.get("price")),
    currency: toStr(formData.get("currency")),
    categoryId: toStr(formData.get("categoryId")),
    ...extra,
  };
  const thumbnailUrl = toStr(formData.get("thumbnailUrl"));
  const thumbnailPath = toStr(formData.get("thumbnailPath"));
  if (thumbnailUrl) raw.thumbnailUrl = thumbnailUrl;
  if (thumbnailPath) raw.thumbnailPath = thumbnailPath;
  return productFormSchema.safeParse(raw);
}

/**
 * Crée un produit en DRAFT pour le vendeur connecté.
 * vendor_id est déterminé côté serveur à partir du profil.
 */
export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const parsed = parseForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
      productId: null,
    };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor/catalogue/nouveau");
  }
  if (current.kind === "missing-profile") {
    return { status: "error", error: "Profil introuvable.", productId: null };
  }
  if (current.profile.status !== "ACTIVE") {
    return {
      status: "error",
      error: "Seul un vendeur ACTIVE peut créer un produit.",
      productId: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (vendor === null) {
    return {
      status: "error",
      error: "Boutique introuvable ou non active.",
      productId: null,
    };
  }

  const result = await createProduct(supabase, vendor.id, parsed.data);

  if (!result.ok) {
    return { status: "error", error: result.error, productId: null };
  }

  revalidatePath("/vendor/catalogue");
  revalidatePath("/vendor");
  return { status: "success", error: null, productId: result.productId };
}

/**
 * Met à jour un produit appartenant au vendeur connecté.
 */
export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const productId = toStr(formData.get("productId"));

  if (!productId) {
    return { status: "error", error: "Produit introuvable.", productId: null };
  }

  const parsed = parseForm(formData);

  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
      productId: null,
    };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor/catalogue");
  }
  if (current.kind === "missing-profile") {
    return { status: "error", error: "Profil introuvable.", productId: null };
  }
  if (current.profile.status !== "ACTIVE") {
    return {
      status: "error",
      error: "Seul un vendeur ACTIVE peut modifier un produit.",
      productId: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  const result = await updateProduct(supabase, productId, parsed.data);

  if (!result.ok) {
    return { status: "error", error: result.error, productId: null };
  }

  revalidatePath("/vendor/catalogue");
  revalidatePath("/vendor");
  return { status: "success", error: null, productId: result.productId };
}

/**
 * Supprime un produit appartenant au vendeur connecté.
 */
export async function deleteProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const productId = toStr(formData.get("productId"));

  if (!productId) {
    return { status: "error", error: "Produit introuvable.", productId: null };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor/catalogue");
  }
  if (current.kind === "missing-profile") {
    return { status: "error", error: "Profil introuvable.", productId: null };
  }
  if (current.profile.status !== "ACTIVE") {
    return {
      status: "error",
      error: "Seul un vendeur ACTIVE peut supprimer un produit.",
      productId: null,
    };
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("products")
    .delete()
    .eq("id", productId)
    .select("id")
    .single();

  if (error !== null) {
    return { status: "error", error: "Impossible de supprimer le produit.", productId: null };
  }
  if (data === null) {
    return { status: "error", error: "Produit introuvable ou accès refusé.", productId: null };
  }

  revalidatePath("/vendor/catalogue");
  revalidatePath("/vendor");
  return { status: "success", error: null, productId: null };
}

/**
 * Supprime l'image de couverture d'un produit.
 */
export async function deleteCoverAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const productId = toStr(formData.get("productId"));

  if (!productId) {
    return { status: "error", error: "Produit introuvable.", productId: null };
  }

  const current = await getCurrentProfile();
  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor/catalogue");
  }
  if (current.kind === "missing-profile") {
    return { status: "error", error: "Profil introuvable.", productId: null };
  }
  if (current.profile.status !== "ACTIVE") {
    return { status: "error", error: "Seul un vendeur ACTIVE peut modifier un produit.", productId: null };
  }

  const supabase = await createSupabaseServerClient();
  const { data: vendor } = await supabase.from("vendors").select("id").eq("user_id", current.profile.id).eq("status", "ACTIVE").maybeSingle();
  if (vendor === null) {
    return { status: "error", error: "Boutique introuvable ou non active.", productId: null };
  }

  const { data: product, error } = await supabase.from("products").select("thumbnail_path, vendor_id").eq("id", productId).maybeSingle();
  if (error !== null || product === null || product.vendor_id !== vendor.id) {
    return { status: "error", error: "Produit introuvable ou accès refusé.", productId: null };
  }

  if (product.thumbnail_path) {
    const admin = createSupabaseAdminClient();
    await admin.storage.from(getStorageBucketProductFiles()).remove([product.thumbnail_path]).catch(() => {});
  }

  try {
    await supabase.from("products").update({ thumbnail_path: null }).eq("id", productId);
  } catch {
    // ignore
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);
  return { status: "success", error: null, productId };
}