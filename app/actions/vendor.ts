"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStorageBucketVendorLogos } from "@/lib/env";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";
import { slugifyFr } from "@/lib/slug";
import { vendorCreationSchema } from "@/schemas/vendor";

export interface VendorFormState {
  error: string | null;
}

const LOGO_MAX_BYTES = 5 * 1024 * 1024;
const LOGO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

function logoExtension(mimeType: string): string {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  return ".webp";
}

async function hasExpectedLogoSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (file.type === "image/png") {
    return bytes.slice(0, 8).every((value, index) => value === [137, 80, 78, 71, 13, 10, 26, 10][index]);
  }
  return (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  );
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
  if (await requiresMfaChallenge(supabase)) {
    return { error: "Vérification en deux étapes requise." };
  }

  const logo = formData.get("logo");
  if (logo !== null && (!(logo instanceof File) || logo.size > LOGO_MAX_BYTES || logo.size === 0)) {
    return { error: "Le logo doit être une image de 5 Mo maximum." };
  }
  if (logo instanceof File && !LOGO_MIME_TYPES.includes(logo.type as (typeof LOGO_MIME_TYPES)[number])) {
    return { error: "Le logo doit être au format JPG, PNG ou WebP." };
  }
  if (logo instanceof File && !(await hasExpectedLogoSignature(logo))) {
    return { error: "Le contenu du logo ne correspond pas au format annoncé." };
  }

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

  let logoPath: string | null = null;
  let logoUrl: string | null = null;
  if (logo instanceof File) {
    logoPath = `${current.profile.id}/logos/${crypto.randomUUID()}${logoExtension(logo.type)}`;
    const admin = createSupabaseAdminClient();
    const { error: uploadError } = await admin.storage
      .from(getStorageBucketVendorLogos())
      .upload(logoPath, logo, { contentType: logo.type, upsert: false });
    if (uploadError !== null) {
      return { error: "Impossible de téléverser le logo. Réessaie dans un instant." };
    }
    logoUrl = admin.storage.from(getStorageBucketVendorLogos()).getPublicUrl(logoPath).data.publicUrl;
  }

  const { error } = await supabase.from("vendors").insert({
    user_id: current.profile.id,
    store_name: parsed.data.storeName,
    description: parsed.data.description,
    slug,
    logo_url: logoUrl,
    status: "ACTIVE",
  });

  if (error !== null) {
    if (logoPath !== null) {
      await createSupabaseAdminClient().storage.from(getStorageBucketVendorLogos()).remove([logoPath]);
    }
    return { error: friendlyVendorError(error.message) };
  }

  revalidatePath("/dashboard");
  revalidatePath("/vendor");
  revalidatePath("/");
  redirect("/vendor?bienvenue=1");
}
