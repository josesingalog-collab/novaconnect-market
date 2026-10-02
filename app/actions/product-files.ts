"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { uploadProductFile } from "@/services/products/product-files";
import { type ProductFormState, initialProductFormState } from "@/lib/product-form-state";

export async function uploadProductFileAction(
  _prevState: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const productId = formData.get("productId")?.toString() ?? "";

  if (!productId) {
    return { ...initialProductFormState, status: "error", error: "Produit introuvable." };
  }

  const current = await getCurrentProfile();
  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor/catalogue");
  }
  if (current.kind === "missing-profile") {
    return { ...initialProductFormState, status: "error", error: "Profil introuvable." };
  }
  if (current.profile.status !== "ACTIVE") {
    return {
      ...initialProductFormState,
      status: "error",
      error: "Seul un vendeur ACTIVE peut uploader un fichier.",
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
      ...initialProductFormState,
      status: "error",
      error: "Boutique introuvable ou non active.",
    };
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return { ...initialProductFormState, status: "error", error: "Fichier requis." };
  }

  const result = await uploadProductFile(supabase, current.profile.id, productId, file);

  if (!result.ok) {
    return { ...initialProductFormState, status: "error", error: result.error };
  }

  revalidatePath(`/vendor/catalogue/${productId}/edit`);
  revalidatePath("/vendor/catalogue");
  return { status: "success", error: null, productId };
}
