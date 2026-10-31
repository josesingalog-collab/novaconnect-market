"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordResetAction, type PasswordResetState } from "@/app/actions/auth";
import { Alert } from "@/components/ui/alert";
import { InputField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

const initialState: PasswordResetState = { error: null, message: null };

export function PasswordResetForm() {
  const [state, formAction, pending] = useActionState(requestPasswordResetAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Réinitialiser le mot de passe
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Indiquez votre adresse e-mail. Nous vous enverrons un lien sécurisé.
        </p>
      </div>
      <InputField
        label="Adresse e-mail"
        id="email"
        name="email"
        type="email"
        placeholder="toi@exemple.com"
        autoComplete="email"
        required
      />
      {state.error !== null && <Alert variant="error">{state.error}</Alert>}
      {state.message !== null && <Alert variant="success">{state.message}</Alert>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Envoi en cours…" : "Envoyer le lien"}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </form>
  );
}
