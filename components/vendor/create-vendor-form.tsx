"use client";

import { useActionState } from "react";
import { createVendorAction, type VendorFormState } from "@/app/actions/vendor";

const initialState: VendorFormState = { error: null };

export function CreateVendorForm() {
  const [state, formAction, pending] = useActionState(createVendorAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="storeName" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Nom de la boutique <span aria-hidden>*</span>
        </label>
        <input
          id="storeName"
          name="storeName"
          type="text"
          required
          minLength={3}
          maxLength={60}
          autoComplete="organization"
          placeholder="Ex. Templates Pro RDC"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          L&apos;adresse publique sera déduite automatiquement (ex. /boutique/templates-pro-rdc).
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Description <span className="font-normal text-zinc-400">(facultatif)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={500}
          placeholder="Ce que tu vends, pour qui…"
          className="resize-y rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-100"
        />
      </div>

      {state.error !== null && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 self-start rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Création…" : "Créer ma boutique"}
      </button>

      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
        Ta boutique est créée immédiatement avec le statut « en attente de validation » : tu peux
        préparer tes produits, mais elle ne sera visible publiquement qu&apos;après validation par
        un administrateur.
      </p>
    </form>
  );
}
