"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createProductAction, updateProductAction } from "@/app/actions/products";
import { initialProductFormState } from "@/lib/product-form-state";
import { InputField, TextareaField, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

interface ProductFormProps {
  initialProduct?: {
    id?: string;
    title: string;
    slug: string;
    shortDescription: string;
    description: string;
    price: string;
    currency: string;
    categoryId: string;
    thumbnailUrl?: string;
    thumbnailPath: string | null;
  };
  categories: { id: string; name: string }[];
}

export function ProductForm({ initialProduct, categories }: ProductFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    initialProduct ? updateProductAction : createProductAction,
    initialProductFormState,
  );

  const isEdit = initialProduct !== undefined;
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === "error" && state.error) {
      titleInputRef.current?.focus();
    }
  }, [state.status, state.error]);

  return (
    <form action={formAction} className="flex flex-col gap-6 max-w-2xl">
      {isEdit && <input type="hidden" name="productId" value={initialProduct.id} />}

      <InputField
        ref={titleInputRef}
        label="Titre"
        name="title"
        defaultValue={initialProduct?.title ?? ""}
        required
        maxLength={150}
        placeholder="Mon produit"
        error={state.status === "error" && state.error ? { message: state.error } : undefined}
      />

      <TextareaField
        label="Description courte"
        name="shortDescription"
        defaultValue={initialProduct?.shortDescription ?? ""}
        maxLength={300}
        rows={2}
        placeholder="Une courte description du produit"
        hint="Maximum 300 caractères"
      />

      <TextareaField
        label="Description longue"
        name="description"
        defaultValue={initialProduct?.description ?? ""}
        maxLength={5000}
        rows={5}
        placeholder="Détaille ton produit..."
        hint="Maximum 5 000 caractères"
      />

      <div className="grid grid-cols-2 gap-4">
        <InputField
          label="Prix"
          name="price"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          defaultValue={initialProduct?.price ?? ""}
          required
          placeholder="0.00"
          hint="En USD ou CDF"
          error={state.status === "error" && state.error ? { message: state.error } : undefined}
        />

        <SelectField
          label="Devise"
          name="currency"
          defaultValue={initialProduct?.currency ?? "USD"}
          required
          options={[
            { value: "USD", label: "USD (Dollar américain)" },
            { value: "CDF", label: "CDF (Franc congolais)" },
          ]}
          error={state.status === "error" && state.error ? { message: state.error } : undefined}
        />
      </div>

      <SelectField
        label="Catégorie"
        name="categoryId"
        defaultValue={initialProduct?.categoryId ?? ""}
        required
        placeholder="Choisir une catégorie"
        options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
        error={state.status === "error" && state.error ? { message: state.error } : undefined}
      />

      {state.error && !state.productId && (
        <div role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          {state.error}
        </div>
      )}

      {state.status === "success" && isEdit && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          Produit mis à jour.
        </div>
      )}

      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? isEdit ? "Mise à jour…" : "Création…"
              : isEdit ? "Modifier le produit" : "Créer le produit"}
          </button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
            Annuler
          </Button>
        </div>
      </div>
    </form>
  );
}