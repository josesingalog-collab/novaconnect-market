"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";
import { safeInternalPath } from "@/lib/navigation";
import { loginSchema, registerSchema } from "@/schemas/auth";

export interface AuthFormState {
  error: string | null;
}

export interface PasswordResetState {
  error: string | null;
  message: string | null;
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "Email ou mot de passe incorrect.";
  }
  if (/rate limit/i.test(message)) {
    return "Trop de tentatives. Réessaie dans quelques instants.";
  }
  if (/password.*at least|weak password/i.test(message)) {
    return "Mot de passe trop faible (8 caractères minimum).";
  }
  if (/email not confirmed/i.test(message)) {
    return "Confirme d'abord ton adresse email (lien envoyé par email).";
  }
  return "Impossible de finaliser cette demande. Vérifie tes informations et réessaie.";
}

export async function loginAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const next = safeInternalPath(String(formData.get("next") ?? ""));
  if (assurance?.currentLevel === "aal1" && assurance.nextLevel === "aal2") {
    redirect(`/auth/two-factor?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function registerAction(
  _prevState: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = registerSchema.safeParse({
    fullName: String(formData.get("fullName") ?? ""),
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirmPassword: String(formData.get("confirmPassword") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Transmis au trigger handle_new_user → profiles.full_name
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${getAppUrl()}/auth/callback`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  // Si la confirmation email est désactivée (recommandé en dev),
  // une session est renvoyée immédiatement.
  if (data.session) {
    redirect("/dashboard");
  }

  return {
    error: "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse.",
  };
}

export async function requestPasswordResetAction(
  _prevState: PasswordResetState,
  formData: FormData,
): Promise<PasswordResetState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { error: "Saisis une adresse e-mail valide.", message: null };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent("/dashboard/mot-de-passe")}`,
  });
  if (error !== null) {
    return { error: friendlyAuthError(error.message), message: null };
  }

  return {
    error: null,
    message: "Si cette adresse est associée à un compte, un lien de réinitialisation vient d'être envoyé.",
  };
}

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
