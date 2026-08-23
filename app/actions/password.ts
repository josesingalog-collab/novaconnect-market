"use server";

import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { passwordChangeSchema } from "@/schemas/password";

export interface PasswordFormState {
  error: string | null;
  success: boolean;
}

function friendlyPasswordError(message: string): string {
  if (/different from the old|same as the old/i.test(message)) {
    return "Le nouveau mot de passe doit être différent de l'actuel.";
  }
  if (/password.*at least|weak password/i.test(message)) {
    return "Mot de passe trop faible (8 caractères minimum).";
  }
  if (/rate limit|too many/i.test(message)) {
    return "Trop de tentatives. Réessaie dans quelques instants.";
  }
  return "Impossible de changer le mot de passe. Vérifie ta session et réessaie.";
}

/**
 * Change le mot de passe de l'utilisateur connecté.
 *
 * Passe par supabase.auth.updateUser avec le client serveur à clé anon
 * (session cookie) : aucun privilège élevé, aucune donnée métier touchée.
 * La session courante reste valide après le changement.
 */
export async function changePasswordAction(
  _prevState: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = passwordChangeSchema.safeParse({
    newPassword: String(formData.get("newPassword") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Données invalides.",
      success: false,
    };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/mot-de-passe");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.newPassword,
  });

  if (error !== null) {
    return { error: friendlyPasswordError(error.message), success: false };
  }

  return { error: null, success: true };
}
