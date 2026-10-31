"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteProductAction } from "@/app/actions/products";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { initialProductFormState, type ProductFormState } from "@/lib/product-form-state";
import { Modal } from "@/components/ui/modal";

export function DeleteProductForm({
  productId,
  productTitle,
  compact = false,
}: {
  productId: string;
  productTitle: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (previousState: ProductFormState, formData: FormData) => {
      const result = await deleteProductAction(previousState, formData);
      if (result.status === "success") {
        setOpen(false);
        router.refresh();
      }
      return result;
    },
    initialProductFormState,
  );

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className={compact ? "w-full justify-start" : undefined}
        onClick={() => setOpen(true)}
      >
        Supprimer
      </Button>
      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Supprimer ce produit ?"
        description="Cette action est définitive."
        size="sm"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <form action={formAction}>
              <input type="hidden" name="productId" value={productId} />
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Suppression…" : "Supprimer"}
              </Button>
            </form>
          </>
        }
      >
        <p className="text-sm leading-6 text-muted-foreground">
          <strong className="text-foreground">{productTitle}</strong> et ses fichiers seront supprimés.
          Les produits déjà commandés ne peuvent pas être supprimés.
        </p>
        {state.status === "error" && state.error && (
          <Alert variant="error" className="mt-4">
            {state.error}
          </Alert>
        )}
      </Modal>
    </>
  );
}
