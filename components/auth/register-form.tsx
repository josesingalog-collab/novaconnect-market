"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, type AuthFormState } from "@/app/actions/auth";
import { InputField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: AuthFormState = { error: null };

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Créer un compte</h1>

      <InputField
        label="Nom complet"
        id="fullName"
        name="fullName"
        type="text"
        placeholder="Jean Kalala"
        autoComplete="name"
        required
        description="Tel que sur votre pièce d'identité"
      />

      <InputField
        label="Adresse e-mail"
        id="email"
        name="email"
        type="email"
        placeholder="toi@exemple.com"
        autoComplete="email"
        required
        description="Utilisé pour la connexion et la confirmation"
      />

      <InputField
        label="Mot de passe"
        id="password"
        name="password"
        type="password"
        placeholder="8 caractères minimum"
        autoComplete="new-password"
        required
        description="Minimum 8 caractères"
      />

      <InputField
        label="Confirmer le mot de passe"
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        required
      />

      {state.error !== null && (
        <Alert variant="error" title="Impossible de créer le compte">
          {state.error}
        </Alert>
      )}

      <Button type="submit" disabled={pending} variant="default" className="mt-1 w-full">
        {pending ? "Création…" : "Créer mon compte"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Déjà inscrit ?{" "}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
