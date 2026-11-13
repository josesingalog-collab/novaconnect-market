"use client";

import { useState } from "react";
import { useActionState } from "react";
import { submitProductAction } from "@/app/actions/products";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Modal } from "@/components/ui/modal";
import { useRouter } from "next/navigation";
import { initialProductFormState, type ProductFormState } from "@/lib/product-form-state";

interface SubmitProductFormProps {
  productId: string;
  productTitle: string;
  compact?: boolean;
}

export function SubmitProductForm({
  productId,
  productTitle,
  compact = false,
}: SubmitProductFormProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    async (prevState: ProductFormState, formData: FormData) => {
      const result = await submitProductAction(prevState, formData);
      if (result.status === "success") {
        router.refresh();
      }
      return result;
    },
    initialProductFormState,
  );

  if (state.status === "success") {
    if (compact) {
      return <span className="text-xs font-medium text-success">Publié</span>;
    }

    return (
      <div className="flex flex-col gap-3">
        <Alert variant="success">
          <span className="font-semibold">Produit publié !</span>
          <p className="mt-1">
            Votre produit est maintenant visible dans le catalogue SAVPAY.
          </p>
        </Alert>
        <div className="flex flex-col gap-3">
          <Button asChild variant="outline" className="w-full">
            <a href="/vendor/catalogue">Retour au catalogue</a>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <a href="/vendor">Retour au tableau de bord</a>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section className={compact ? "" : "flex flex-col gap-3"}>
      {!compact && (
        <>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Publier ce produit</h2>
          <Alert variant="info">
            <span className="font-semibold">{productTitle}</span>
            <p className="mt-1">Après publication, il sera immédiatement visible dans le catalogue.</p>
          </Alert>
        </>
      )}

      {state.status === "error" && state.error && (
        <Alert variant="error" className={compact ? "mb-2" : undefined}>
          {state.error}
        </Alert>
      )}

      {!pending && (
        <Button
          onClick={() => setOpen(true)}
          className={compact ? "w-full justify-start" : "w-full"}
          size={compact ? "sm" : "lg"}
        >
          Publier le produit
        </Button>
      )}

      {pending && (
        <Button disabled className={compact ? "w-full justify-start" : "w-full"} size={compact ? "sm" : "lg"}>
          Envoi en cours…
        </Button>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title="Publier ce produit ?"
        description="Votre produit sera immédiatement visible dans le catalogue SAVPAY."
        actions={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <form action={formAction}>
              <input type="hidden" name="productId" value={productId} />
              <Button type="submit" disabled={pending}>
                {pending ? "Publication…" : "Publier"}
              </Button>
            </form>
          </>
        }
        size="sm"
      >
        <p className="text-sm text-muted-foreground">Confirmez la publication de votre produit.</p>
      </Modal>
    </section>
  );
}
