import { z } from "zod";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const vendorIdSchema = z.uuid();

export type AdminVendorTransition = "approve" | "reject" | "suspend" | "reactivate";

const TRANSITION_TARGET: Record<AdminVendorTransition, string> = {
  approve: "ACTIVE",
  reject: "REJECTED",
  suspend: "SUSPENDED",
  reactivate: "ACTIVE",
};

export async function transitionAdminVendor(
  vendorId: string,
  transition: AdminVendorTransition,
): Promise<void> {
  if (!vendorIdSchema.safeParse(vendorId).success) {
    throw new Error("Identifiant de boutique invalide.");
  }

  const current = await getCurrentProfile();
  if (
    current.kind !== "ok" ||
    current.profile.role !== "ADMIN" ||
    current.profile.status !== "ACTIVE"
  ) {
    throw new Error("Accès administrateur requis.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("admin_transition_vendor", {
    p_vendor: vendorId,
    p_target: TRANSITION_TARGET[transition],
  });

  if (error !== null) {
    throw new Error(error.message || "Impossible de mettre à jour la boutique.");
  }
}
