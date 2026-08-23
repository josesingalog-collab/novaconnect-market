"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { profileSchema } from "@/schemas/profile";

export interface ProfileFormState {
  error: string | null;
  success: boolean;
}

/**
 * Met à jour le profil de l'utilisateur connecté.
 *
 * - Client à clé anon : la RLS limite l'UPDATE à la propre ligne du profil ;
 * - `role` / `status` ne font JAMAIS partie du payload (garde PostgreSQL en
 *   dernier rempart de toute façon) ;
 * - le helper S1 fournit la session + l'id de ligne sans duplication.
 */
export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const parsed = profileSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    avatarUrl: String(formData.get("avatarUrl") ?? "").trim(),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
      success: false,
    };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/profil");
  }

  if (current.kind === "missing-profile") {
    return {
      error: "Profil introuvable. Réessaie dans un instant ou reconnecte-toi.",
      success: false,
    };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone,
      avatar_url: parsed.data.avatarUrl,
    })
    .eq("id", current.profile.id);

  if (error !== null) {
    return {
      error: "Impossible d'enregistrer les modifications. Réessaie dans quelques instants.",
      success: false,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profil");
  return { error: null, success: true };
}
