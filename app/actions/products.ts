"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStorageBucketProductFiles } from "@/lib/env";
import { productFormSchema } from "@/schemas/product-form";
import { createProduct, updateProduct, updateProductStatus } from "@/services/products/manage";
import { type ProductFormState } from "@/lib/product-form-state";

function toStr(value: FormDataEntryValue | null): string {
  if (value === null) return "";
  return typeof value === "string" ? value : "";
}

function parseForm(formData: FormData, extra?: Record<string, string>) {
  const raw: Record<string, string> = {
    productType: toStr(formData.get("productType")),
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
  if (!raw.productType || !["SERVICE", "PHYSICAL", "DIGITAL"].includes(raw.productType)) {
    raw.productType = "PHYSICAL";
  }
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
 * Le statut du produit doit être DRAFT ou REJECTED pour autoriser la modification.
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

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (vendor === null) {
    return { status: "error", error: "Boutique introuvable ou non active.", productId: null };
  }

  const { data: product } = await supabase
    .from("products")
    .select("id, status, vendor_id")
    .eq("id", productId)
    .eq("vendor_id", vendor.id)
    .maybeSingle();
  if (product === null) {
    return { status: "error", error: "Produit introuvable ou accès refusé.", productId: null };
  }

  if (product.status === "PENDING_REVIEW") {
    return {
      status: "error",
      error: "Ce produit est actuellement en cours de vérification et ne peut pas être modifié.",
      productId: null,
    };
  }

  if (product.status === "PUBLISHED") {
    return {
      status: "error",
      error: "Ce produit est déjà publié et ne peut pas être modifié depuis cet espace.",
      productId: null,
    };
  }

  if (product.status === "ARCHIVED") {
    return {
      status: "error",
      error: "Ce produit est archivé et ne peut pas être modifié.",
      productId: null,
    };
  }

  const result = await updateProduct(supabase, productId, parsed.data);

  if (!result.ok) {
    return { status: "error", error: result.error, productId: null };
  }

  revalidatePath("/vendor/catalogue");
  revalidatePath("/vendor");
  return { status: "success", error: null, productId: result.productId };
}

/**
 * Soumet un produit à la validation (→ PENDING_REVIEW).
 *
 * Workflow explicite :
 *  - DRAFT → PENDING_REVIEW
 *  - REJECTED → PENDING_REVIEW (après correction)
 *  - PENDING_REVIEW → déjà soumis, refus
 *  - PUBLISHED → refus
 *  - ARCHIVED → refus
 */
export async function submitProductAction(
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
      error: "Seul un vendeur ACTIVE peut soumettre un produit.",
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

  const { data: product } = await supabase
    .from("products")
    .select("id, status")
    .eq("id", productId)
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (product === null) {
    return {
      status: "error",
      error: "Produit introuvable ou accès refusé.",
      productId: null,
    };
  }

  if (product.status === "DRAFT") {
    const result = await updateProductStatus(supabase, productId, vendor.id);
    if (!result.ok) {
      return { status: "error", error: result.error, productId: null };
    }
    revalidatePath(`/vendor/catalogue/${productId}/edit`);
    revalidatePath("/vendor/catalogue");
    return { status: "success", error: null, productId };
  }

  if (product.status === "REJECTED") {
    const result = await updateProductStatus(supabase, productId, vendor.id);
    if (!result.ok) {
      return { status: "error", error: result.error, productId: null };
    }
    revalidatePath(`/vendor/catalogue/${productId}/edit`);
    revalidatePath("/vendor/catalogue");
    return { status: "success", error: null, productId };
  }

  if (product.status === "PENDING_REVIEW") {
    return {
      status: "error",
      error: "Ce produit est déjà en cours de vérification.",
      productId: null,
    };
  }

  if (product.status === "PUBLISHED") {
    return { status: "error", error: "Ce produit est déjà publié.", productId: null };
  }

  if (product.status === "ARCHIVED") {
    return { status: "error", error: "Ce produit est archivé.", productId: null };
  }

  return { status: "error", error: "Statut du produit non reconnu.", productId: null };
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

const MAX_REJECTION_REASON_LENGTH = 500;
const MIN_REJECTION_REASON_LENGTH = 5;

function validateRejectionReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length === 0) return "Le motif de rejet est obligatoire.";
  if (trimmed.length < MIN_REJECTION_REASON_LENGTH)
    return `Le motif de rejet doit contenir au moins ${MIN_REJECTION_REASON_LENGTH} caractères.`;
  if (trimmed.length > MAX_REJECTION_REASON_LENGTH)
    return `Le motif de rejet ne peut pas dépasser ${MAX_REJECTION_REASON_LENGTH} caractères.`;
  return null;
}

/**
 * Approuve un produit en PENDING_REVIEW → PUBLISHED.
 * Seul un ADMIN peut utiliser cette action.
 */
export async function approveProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const productId = toStr(formData.get("productId"));

  if (!productId) {
    return { status: "error", error: "Produit introuvable.", productId: null };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/admin");
  }
  if (current.kind === "missing-profile") {
    return { status: "error", error: "Profil introuvable.", productId: null };
  }
  if (current.profile.role !== "ADMIN" || current.profile.status !== "ACTIVE") {
    return {
      status: "error",
      error: "Seul un ADMIN ACTIVE peut approuver un produit.",
      productId: null,
    };
  }

  const admin = createSupabaseAdminClient();

  const { data: product, error } = await admin
    .from("products")
    .select("id, status, vendor_id")
    .eq("id", productId)
    .maybeSingle();

  if (error !== null || product === null) {
    return { status: "error", error: "Produit introuvable.", productId: null };
  }

  if (product.status !== "PENDING_REVIEW") {
    if (product.status === "PUBLISHED") {
      return { status: "error", error: "Ce produit est déjà publié.", productId: null };
    }
    return {
      status: "error",
      error: `Ce produit ne peut pas être approuvé depuis le statut ${product.status}.`,
      productId: null,
    };
  }

  const { error: updateError } = await admin
    .from("products")
    .update({ status: "PUBLISHED" })
    .eq("id", productId)
    .select("id")
    .single();

  if (updateError !== null) {
    return { status: "error", error: "Impossible d'approuver le produit.", productId: null };
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);
  revalidatePath("/vendor/catalogue");
  revalidatePath("/admin");
  return { status: "success", error: null, productId };
}

/**
 * Rejette un produit en PENDING_REVIEW → REJECTED avec motif.
 * Seul un ADMIN peut utiliser cette action.
 */
export async function rejectProductAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const productId = toStr(formData.get("productId"));
  const rejectionReason = toStr(formData.get("rejectionReason"));

  if (!productId) {
    return { status: "error", error: "Produit introuvable.", productId: null };
  }

  const reasonError = validateRejectionReason(rejectionReason);
  if (reasonError !== null) {
    return { status: "error", error: reasonError, productId: null };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/admin");
  }
  if (current.kind === "missing-profile") {
    return { status: "error", error: "Profil introuvable.", productId: null };
  }
  if (current.profile.role !== "ADMIN" || current.profile.status !== "ACTIVE") {
    return {
      status: "error",
      error: "Seul un ADMIN ACTIVE peut rejeter un produit.",
      productId: null,
    };
  }

  const admin = createSupabaseAdminClient();

  const { data: product, error } = await admin
    .from("products")
    .select("id, status")
    .eq("id", productId)
    .maybeSingle();

  if (error !== null || product === null) {
    return { status: "error", error: "Produit introuvable.", productId: null };
  }

  if (product.status !== "PENDING_REVIEW") {
    if (product.status === "PUBLISHED") {
      return { status: "error", error: "Ce produit est déjà publié.", productId: null };
    }
    return {
      status: "error",
      error: `Ce produit ne peut pas être rejeté depuis le statut ${product.status}.`,
      productId: null,
    };
  }

  const { error: updateError } = await admin
    .from("products")
    .update({ status: "REJECTED", rejection_reason: rejectionReason.trim() })
    .eq("id", productId)
    .select("id")
    .single();

  if (updateError !== null) {
    return { status: "error", error: "Impossible de rejeter le produit.", productId: null };
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);
  revalidatePath("/vendor/catalogue");
  revalidatePath("/admin");
  return { status: "success", error: null, productId };
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
    return {
      status: "error",
      error: "Seul un vendeur ACTIVE peut modifier un produit.",
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
    return { status: "error", error: "Boutique introuvable ou non active.", productId: null };
  }

  const { data: product, error } = await supabase
    .from("products")
    .select("thumbnail_path, vendor_id")
    .eq("id", productId)
    .maybeSingle();
  if (error !== null || product === null || product.vendor_id !== vendor.id) {
    return { status: "error", error: "Produit introuvable ou accès refusé.", productId: null };
  }

  const { error: updateError } = await supabase
    .from("products")
    .update({ thumbnail_path: null })
    .eq("id", productId);
  if (updateError !== null) {
    return {
      status: "error",
      error: "Impossible de supprimer l'image de couverture.",
      productId: null,
    };
  }

  if (product.thumbnail_path) {
    const admin = createSupabaseAdminClient();
    const { error: removeError } = await admin.storage
      .from(getStorageBucketProductFiles())
      .remove([product.thumbnail_path]);
    if (removeError !== null) {
      return {
        status: "error",
        error: "Image dissociée, mais sa suppression du stockage a échoué.",
        productId: null,
      };
    }
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);
  return { status: "success", error: null, productId };
}
