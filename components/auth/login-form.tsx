"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { InputField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: AuthFormState = { error: null };

export function LoginForm({ nextPath }: { nextPath: string }) {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex w-full max-w-md flex-col gap-5">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">Connexion</h1>

      <input type="hidden" name="next" value={nextPath} />

      <InputField
        label="Adresse e-mail"
        id="email"
        name="email"
        type="email"
        placeholder="toi@exemple.com"
        autoComplete="email"
        required
        description="Utilisé pour la connexion et les notifications"
      />

      <InputField
        label="Mot de passe"
        id="password"
        name="password"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        required
      />

      <div className="-mt-2 flex justify-end">
        <Link
          href="/forgot-password"
          className="text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Mot de passe oublié ?
        </Link>
      </div>

      {state.error !== null && (
        <Alert variant="error" title="Impossible de se connecter">
          {state.error}
        </Alert>
      )}

      <Button type="submit" disabled={pending} variant="default" className="mt-1 w-full">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
