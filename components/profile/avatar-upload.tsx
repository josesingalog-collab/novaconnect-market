"use client";

import { useEffect, useActionState, useState } from "react";
import { uploadAvatarAction, type AvatarFormState } from "@/app/actions/avatar";

const initialState: AvatarFormState = { error: null, success: false, avatarUrl: null };

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function AvatarUpload({ currentUrl }: { currentUrl: string | null }) {
  const [state, formAction, pending] = useActionState(uploadAvatarAction, initialState);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl);
  const [localError, setLocalError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl !== null && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (file === undefined) {
      return;
    }

    setLocalError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setLocalError("Format non pris en charge (JPEG, PNG ou WebP uniquement).");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      setLocalError("Image trop lourde (2 Mo maximum).");
      event.target.value = "";
      return;
    }

    if (previewUrl !== null && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
  }

  const displayedUrl = state.success && state.avatarUrl !== null ? state.avatarUrl : previewUrl;

  return (
    <form action={formAction} className="flex flex-col gap-4 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- URL publique Supabase ou blob local */}
      <img
        src={displayedUrl ?? "/avatar-placeholder.svg"}
        alt="Aperçu de l'avatar"
        className="h-20 w-20 rounded-full border border-zinc-300 object-cover dark:border-zinc-700"
      />

      <div className="flex flex-1 flex-col gap-2">
        <label htmlFor="avatar" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Photo de profil — JPEG, PNG ou WebP · 2 Mo maximum
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileChange}
          className="block w-full cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-100 dark:file:text-zinc-900"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {fileName !== null ? `Fichier sélectionné : ${fileName}` : "Aucun fichier sélectionné."}
        </p>

        {localError !== null && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {localError}
          </p>
        )}
        {state.error !== null && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            Avatar mis à jour.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || fileName === null}
          className="self-start rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Envoi…" : "Envoyer l'avatar"}
        </button>
      </div>
    </form>
  );
}
