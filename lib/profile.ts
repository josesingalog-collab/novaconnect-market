/**
 * Accès serveur au profil de l'utilisateur connecté.
 *
 * Utilise le client serveur à clé anon (RLS active) : un utilisateur ne peut
 * lire que SON profil — voir policy profiles_select_self_or_admin.
 *
 * Le helper est PUR : il renvoie une union discriminée et laisse l'appelant
 * décider de la navigation (redirect, page d'erreur…).
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type UserRole = "BUYER" | "VENDOR" | "ADMIN";
export type AccountStatus = "ACTIVE" | "SUSPENDED";

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  role: UserRole;
  status: AccountStatus;
  /** Date ISO 8601 (timestamptz PostgreSQL). */
  createdAt: string;
}

export type CurrentProfileResult =
  | { kind: "unauthenticated" }
  | { kind: "missing-profile"; userId: string }
  | { kind: "ok"; profile: UserProfile };

const USER_ROLES: readonly UserRole[] = ["BUYER", "VENDOR", "ADMIN"] as const;
const ACCOUNT_STATUSES: readonly AccountStatus[] = ["ACTIVE", "SUSPENDED"] as const;

function toUserRole(value: string): UserRole {
  return (USER_ROLES as readonly string[]).includes(value) ? (value as UserRole) : "BUYER";
}

function toAccountStatus(value: string): AccountStatus {
  return (ACCOUNT_STATUSES as readonly string[]).includes(value)
    ? (value as AccountStatus)
    : "ACTIVE";
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string;
  status: string;
  created_at: string;
}

/**
 * Renvoie l'état d'authentification et le profil éventuel de l'utilisateur
 * courant, en une seule passe (auth.getUser + lecture RLS de profiles).
 */
export async function getCurrentProfile(): Promise<CurrentProfileResult> {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError !== null || user === null) {
    return { kind: "unauthenticated" };
  }

  const { data: row, error: profileError } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, avatar_url, role, status, created_at")
    .eq("id", user.id)
    .single();

  if (profileError !== null || row === null) {
    // Compte auth existant mais profil absent (création trigger en cours…) :
    // état transitoire signalé à l'appelant plutôt que masqué.
    return { kind: "missing-profile", userId: user.id };
  }

  const profile = row as ProfileRow;

  return {
    kind: "ok",
    profile: {
      id: profile.id,
      email: profile.email,
      fullName: profile.full_name,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      role: toUserRole(profile.role),
      status: toAccountStatus(profile.status),
      createdAt: profile.created_at,
    },
  };
}
