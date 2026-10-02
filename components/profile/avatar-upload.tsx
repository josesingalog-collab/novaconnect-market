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
        className="border-input h-20 w-20 rounded-full border object-cover"
      />

      <div className="flex flex-1 flex-col gap-2">
        <label htmlFor="avatar" className="text-sm font-medium text-foreground">
          Photo de profil — JPEG, PNG ou WebP · 2 Mo maximum
        </label>
        <input
          id="avatar"
          name="avatar"
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          onChange={handleFileChange}
          className="border-input block w-full cursor-pointer rounded-lg border bg-background px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground"
        />
        <p className="text-xs text-muted-foreground">
          {fileName !== null ? `Fichier sélectionné : ${fileName}` : "Aucun fichier sélectionné."}
        </p>

        {localError !== null && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {localError}
          </p>
        )}
        {state.error !== null && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {state.error}
          </p>
        )}
        {state.success && (
          <p role="status" className="rounded-lg bg-success/5 px-3 py-2 text-sm text-success">
            Avatar mis à jour.
          </p>
        )}

        <button
          type="submit"
          disabled={pending || fileName === null}
          className="self-start rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Envoi…" : "Envoyer l'avatar"}
        </button>
      </div>
    </form>
  );
}
