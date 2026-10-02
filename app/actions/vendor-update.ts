"use server";

import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/profile";
import { vendorUpdateSchema } from "@/schemas/vendor-update";
import { updateVendor } from "@/services/vendor/boutique";

export interface VendorUpdateFormState {
  readonly success: boolean;
  readonly error: string | null;
  readonly data: { readonly storeName: string; readonly description: string | null } | null;
}

function toStringValue(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value : "";
}

/** Met à jour la boutique du vendeur connecté, sans accepter d'identifiant client. */
export async function updateVendorAction(
  _previousState: VendorUpdateFormState,
  formData: FormData,
): Promise<VendorUpdateFormState> {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    return { success: false, error: "Authentification requise.", data: null };
  }
  if (current.kind === "missing-profile") {
    return { success: false, error: "Profil introuvable.", data: null };
  }
  if (current.profile.role !== "VENDOR" || current.profile.status !== "ACTIVE") {
    return {
      success: false,
      error: "Seul un vendeur ACTIVE peut modifier sa boutique.",
      data: null,
    };
  }

  const parsed = vendorUpdateSchema.safeParse({
    storeName: toStringValue(formData.get("storeName")),
    description: toStringValue(formData.get("description")),
  });

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
      data: null,
    };
  }

  const result = await updateVendor(parsed.data);
  if (!result.ok) {
    return { success: false, error: result.error, data: null };
  }

  revalidatePath("/vendor");
  revalidatePath("/");
  revalidatePath("/catalogue");
  revalidatePath(`/boutique/${result.vendor.slug}`);

  return {
    success: true,
    error: null,
    data: {
      storeName: result.vendor.storeName,
      description: result.vendor.description,
    },
  };
}
