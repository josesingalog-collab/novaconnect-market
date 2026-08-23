/**
 * Gardes d'accès par rôle pour les layouts serveur.
 *
 * Le middleware (proxy.ts) est la barrière UX ; ici on revalide côté serveur
 * avec le profil réel (RLS) avant de rendre quoi que ce soit.
 */
import { redirect } from "next/navigation";
import { getCurrentProfile, type UserProfile, type UserRole } from "@/lib/profile";

export async function requireRole(role: UserRole, nextPath: string): Promise<UserProfile> {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect(`/login?next=${nextPath}`);
  }

  // Profil manquant ou rôle/statut insuffisant : retour à l'espace personnel,
  // sans révéler la nature de l'espace protégé.
  if (current.kind === "missing-profile") {
    redirect("/dashboard");
  }

  if (current.profile.role !== role || current.profile.status !== "ACTIVE") {
    redirect("/dashboard");
  }

  return current.profile;
}
