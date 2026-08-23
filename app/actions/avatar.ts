"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface AvatarFormState {
  error: string | null;
  success: boolean;
  avatarUrl: string | null;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const AVATAR_SIGNATURES = [
  { mime: "image/jpeg", ext: "jpg", bytes: [0xff, 0xd8, 0xff] },
  {
    mime: "image/png",
    ext: "png",
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
  },
] as const;

function detectImage(buffer: Uint8Array): { mime: string; ext: string } | null {
  for (const signature of AVATAR_SIGNATURES) {
    if (
      buffer.length >= signature.bytes.length &&
      signature.bytes.every((byte, index) => buffer[index] === byte)
    ) {
      return { mime: signature.mime, ext: signature.ext };
    }
  }

  // WebP : RIFF....WEBP
  const riff = new TextDecoder().decode(buffer.slice(0, 4));
  const webp = new TextDecoder().decode(buffer.slice(8, 12));
  if (riff === "RIFF" && webp === "WEBP") {
    return { mime: "image/webp", ext: "webp" };
  }

  return null;
}

/**
 * Téléverse l'avatar de l'utilisateur connecté vers Storage puis enregistre
 * son URL publique dans profiles.avatar_url.
 *
 * - Client à clé anon (session cookie) : la policy Storage limite l'écriture
 *   au dossier `<user_id>/` du compte ; la RLS profiles limite l'UPDATE ;
 * - Type MIME vérifié par signature binaire (pas par le champ `type` du
 *   navigateur, falsifiable) et taille ≤ 2 Mo ;
 * - Chemin fixe `<user_id>/avatar.<ext>` avec upsert : aucun doublon accumulé.
 */
export async function uploadAvatarAction(
  _prevState: AvatarFormState,
  formData: FormData,
): Promise<AvatarFormState> {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/profil");
  }

  if (current.kind === "missing-profile") {
    return {
      error: "Profil introuvable. Réessaie dans un instant ou reconnecte-toi.",
      success: false,
      avatarUrl: null,
    };
  }

  const file = formData.get("avatar");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Sélectionne d'abord une image.", success: false, avatarUrl: null };
  }

  if (file.size > MAX_AVATAR_BYTES) {
    return {
      error: "Image trop lourde (2 Mo maximum).",
      success: false,
      avatarUrl: null,
    };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const detected = detectImage(buffer);

  if (detected === null) {
    return {
      error: "Format non pris en charge (JPEG, PNG ou WebP uniquement).",
      success: false,
      avatarUrl: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const path = `${current.profile.id}/avatar.${detected.ext}`;

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, buffer, { contentType: detected.mime, upsert: true });

  if (uploadError !== null) {
    return {
      error: "Envoi impossible. Réessaie dans quelques instants.",
      success: false,
      avatarUrl: null,
    };
  }

  const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: urlData.publicUrl })
    .eq("id", current.profile.id);

  if (updateError !== null) {
    return {
      error: "Avatar envoyé mais enregistrement du profil impossible.",
      success: false,
      avatarUrl: null,
    };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profil");
  return { error: null, success: true, avatarUrl: urlData.publicUrl };
}
