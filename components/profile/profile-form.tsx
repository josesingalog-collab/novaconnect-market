"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileFormState } from "@/app/actions/profile";
import type { UserProfile } from "@/lib/profile";

const initialState: ProfileFormState = { error: null, success: false };

function Field({
  label,
  id,
  name,
  type,
  placeholder,
  autoComplete,
  defaultValue,
}: {
  label: string;
  id: string;
  name: string;
  type: string;
  placeholder?: string;
  autoComplete?: string;
  defaultValue?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="border-input rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-60"
      />
    </div>
  );
}

export function ProfileForm({ profile }: { profile: UserProfile }) {
  const [state, formAction, pending] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <Field
        label="Nom complet"
        id="fullName"
        name="fullName"
        type="text"
        placeholder="Jean Kalala"
        autoComplete="name"
        defaultValue={profile.fullName}
      />
      <Field
        label="Téléphone (optionnel)"
        id="phone"
        name="phone"
        type="tel"
        placeholder="+243 999 000 000"
        autoComplete="tel"
        defaultValue={profile.phone ?? ""}
      />
      <Field
        label="Avatar — URL d'image (optionnel)"
        id="avatarUrl"
        name="avatarUrl"
        type="url"
        placeholder="https://exemple.com/avatar.png"
        defaultValue={profile.avatarUrl ?? ""}
      />

      {state.error !== null && (
        <p role="alert" className="rounded-lg bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg bg-success/5 px-3 py-2 text-sm text-success">
          Profil mis à jour.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
