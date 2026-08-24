"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugifyFr } from "@/lib/slug";
import { vendorCreationSchema } from "@/schemas/vendor";

export interface VendorFormState {
  error: string | null;
}

function friendlyVendorError(message: string): string {
  if (/duplicate key|unique constraint/i.test(message)) {
    return "Une boutique est déjà associée à ton compte.";
  }
  return "Impossible de créer la boutique pour le moment. Réessaie dans un instant.";
}

/**
 * Crée la boutique de l'utilisateur connecté (BUYER uniquement).
 *
 * Le client n'envoie jamais user_id ni role : l'INSERT passe par le client
 * serveur à clé anon (session cookie) — la policy vendors_insert_own exige
 * user_id = auth.uid(), et le trigger 0010 promeut automatiquement le profil
 * BUYER → VENDOR côté base. Le slug est généré et dédoublonné serveur.
 */
export async function createVendorAction(
  _prevState: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const parsed = vendorCreationSchema.safeParse({
    storeName: String(formData.get("storeName") ?? ""),
    description: String(formData.get("description") ?? ""),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  }

  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/devenir-vendeur");
  }
  if (current.kind === "missing-profile") {
    return { error: "Profil introuvable. Déconnecte-toi puis reconnecte-toi." };
  }
  if (current.profile.role === "VENDOR") {
    redirect("/vendor");
  }
  if (current.profile.role !== "BUYER") {
    return { error: "La création de boutique est réservée aux comptes acheteurs." };
  }

  const supabase = await createSupabaseServerClient();

  // Slug unique : base dérivée du nom, suffixe numérique en cas de collision.
  let slug = slugifyFr(parsed.data.storeName);
  if (slug.length === 0) {
    return { error: "Le nom de boutique ne permet pas de générer une adresse valide." };
  }
  for (let attempt = 2; attempt <= 21; attempt += 1) {
    const { data: existing } = await supabase
      .from("vendors")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (existing === null) break;
    slug = `${slugifyFr(parsed.data.storeName)}-${attempt}`;
  }

  const { error } = await supabase.from("vendors").insert({
    user_id: current.profile.id,
    store_name: parsed.data.storeName,
    description: parsed.data.description,
    slug,
  });

  if (error !== null) {
    return { error: friendlyVendorError(error.message) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/vendor");
  revalidatePath("/");
  redirect("/vendor?bienvenue=1");
}
