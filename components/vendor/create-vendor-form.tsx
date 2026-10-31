"use client";

import { useActionState } from "react";
import { createVendorAction, type VendorFormState } from "@/app/actions/vendor";

const initialState: VendorFormState = { error: null };

export function CreateVendorForm() {
  const [state, formAction, pending] = useActionState(createVendorAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="storeName" className="text-sm font-medium text-foreground">
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
          className="border-input min-h-[48px] rounded-xl border bg-muted/45 px-3 py-2 text-sm text-foreground transition outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
        />
        <p className="text-xs leading-5 text-muted-foreground">
          L&apos;adresse publique sera déduite automatiquement (ex. /boutique/templates-pro-rdc).
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="description" className="text-sm font-medium text-foreground">
          Description <span className="font-normal text-muted-foreground">(facultatif)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          maxLength={500}
          placeholder="Ce que tu vends, pour qui…"
          className="border-input min-h-28 resize-y rounded-xl border bg-muted/45 px-3 py-2 text-sm text-foreground transition outline-none focus:border-primary focus:bg-background focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="logo" className="text-sm font-medium text-foreground">
          Logo de la boutique <span className="font-normal text-muted-foreground">(facultatif)</span>
        </label>
        <input
          id="logo"
          name="logo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="border-input min-h-[48px] rounded-xl border bg-muted/45 px-3 py-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-2.5 file:py-1.5 file:text-sm file:font-medium file:text-primary"
        />
        <p className="text-xs leading-5 text-muted-foreground">JPG, PNG ou WebP · 5 Mo maximum.</p>
      </div>

      {state.error !== null && (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 min-h-[48px] w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/15 transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Création…" : "Créer ma boutique"}
      </button>

      <p className="text-xs leading-5 text-muted-foreground">
        Votre boutique est visible immédiatement. Vous pouvez créer et publier vos produits dès
        maintenant.
      </p>
    </form>
  );
}
