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
  productStatus: string;
  productTitle: string;
}

export function SubmitProductForm({
  productId,
  productStatus,
  productTitle,
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

  const isRejected = productStatus === "REJECTED";

  if (state.status === "success") {
    return (
      <div className="flex flex-col gap-3">
        <Alert variant="success">
          <span className="font-semibold">Produit envoyé !</span>
          <p className="mt-1">
            Votre produit est maintenant en cours de vérification. Notre équipe vérifie les
            informations avant sa publication.
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
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {isRejected ? "Renvoyer en vérification" : "Envoyer en vérification"}
      </h2>

      {isRejected && (
        <Alert variant="warning">
          <span className="font-semibold">Modifications demandées</span>
          <p className="mt-1">Corrigez les éléments demandés avant de renvoyer votre produit.</p>
        </Alert>
      )}

      <Alert variant="info">
        <span className="font-semibold">{productTitle}</span>
        <p className="mt-1">
          Notre équipe vérifiera les informations avant sa publication. Le produit ne sera visible
          qu&apos;après validation.
        </p>
      </Alert>

      {state.status === "error" && state.error && <Alert variant="error">{state.error}</Alert>}

      {!pending && (
        <Button onClick={() => setOpen(true)} className="w-full" size="lg">
          {isRejected ? "Renvoyer en vérification" : "Envoyer en vérification"}
        </Button>
      )}

      {pending && (
        <Button disabled className="w-full" size="lg">
          Envoi en cours…
        </Button>
      )}

      <Modal
        open={open}
        onOpenChange={setOpen}
        title={isRejected ? "Renvoyer en vérification ?" : "Envoyer en vérification ?"}
        description={
          isRejected
            ? "Votre produit a été rejeté. Après correction, il sera renvoyé à l&apos;équipe NovaConnect pour validation."
            : "Votre produit sera envoyé à notre équipe pour vérification. Il ne sera visible que après validation."
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Annuler
            </Button>
            <form action={formAction}>
              <input type="hidden" name="productId" value={productId} />
              <Button type="submit" disabled={pending}>
                {pending ? (isRejected ? "Envoi…" : "Envoi…") : isRejected ? "Renvoyer" : "Envoyer"}
              </Button>
            </form>
          </>
        }
        size="sm"
      >
        <p className="text-sm text-muted-foreground">
          {isRejected
            ? "Votre produit sera renvoyé en vérification après les corrections demandées."
            : "Confirmez l&apos;envoi pour que notre équipe vérifie votre produit."}
        </p>
      </Modal>
    </section>
  );
}
