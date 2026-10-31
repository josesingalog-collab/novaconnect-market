"use client";

import { useActionState } from "react";
import { changePasswordAction, type PasswordFormState } from "@/app/actions/password";
import { InputField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

const initialState: PasswordFormState = { error: null, success: false };

export function PasswordChangeForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <InputField
        label="Nouveau mot de passe"
        id="newPassword"
        name="newPassword"
        type="password"
        placeholder="8 caractères minimum"
        autoComplete="new-password"
        required
        description="Minimum 8 caractères"
      />
      <InputField
        label="Confirmer le nouveau mot de passe"
        id="confirmPassword"
        name="confirmPassword"
        type="password"
        placeholder="••••••••"
        autoComplete="new-password"
        required
      />

      {state.error !== null && (
        <Alert variant="error" title="Impossible de changer le mot de passe">
          {state.error}
        </Alert>
      )}
      <Button type="submit" disabled={pending} variant="default" className="mt-1 self-start">
        {pending ? "Mise à jour…" : "Changer le mot de passe"}
      </Button>
    </form>
  );
}
