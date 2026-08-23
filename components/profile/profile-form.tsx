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
      <label htmlFor={id} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
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
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          Profil mis à jour.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Enregistrement…" : "Enregistrer"}
      </button>
    </form>
  );
}
