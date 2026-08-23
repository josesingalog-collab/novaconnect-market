"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loginSchema, registerSchema } from "@/schemas/auth";

export interface AuthFormState {
  error: string | null;
}

function friendlyAuthError(message: string): string {
  if (/invalid login credentials/i.test(message)) {
    return "Email ou mot de passe incorrect.";
  }
  if (/already registered|already exists/i.test(message)) {
    return "Un compte existe déjà avec cet email.";
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
  return "Une erreur est survenue. Vérifie tes informations et réessaie.";
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

  const next = String(formData.get("next") ?? "/dashboard");
  redirect(next.startsWith("/") ? next : "/dashboard");
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
  const headerList = await headers();

  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Transmis au trigger handle_new_user → profiles.full_name
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${headerList.get("origin") ?? ""}/auth/callback`,
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

export async function logoutAction(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/");
}
