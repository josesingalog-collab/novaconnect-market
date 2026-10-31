"use server";

import { revalidatePath } from "next/cache";
import { transitionAdminVendor, type AdminVendorTransition } from "@/services/admin/vendors";

export interface AdminVendorActionState {
  success: boolean;
  error: string | null;
}

export async function transitionAdminVendorAction(
  vendorId: string,
  transition: AdminVendorTransition,
): Promise<AdminVendorActionState> {
  try {
    await transitionAdminVendor(vendorId, transition);
    revalidatePath("/admin/vendeurs");
    revalidatePath("/vendor");
    revalidatePath("/");
    revalidatePath("/catalogue");
    revalidatePath("/boutique/[slug]", "page");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Impossible de mettre à jour la boutique.",
    };
  }
}
