"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/field";
import { Alert } from "@/components/ui/alert";
import { SelectField } from "@/components/ui/field";
import { requestWithdrawalAction } from "@/app/actions/finances";
import { withdrawalPayoutSchema } from "@/schemas/withdrawal";
import { decimalStringToMinor } from "@/lib/money";

export function WithdrawalForm() {
  const { addToast } = useToast();
  const [method, setMethod] = useState<"mobile_money" | "bank">("mobile_money");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [operator, setOperator] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [isSubmitting, startTransition] = useTransition();
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleMethodChange = (newMethod: "mobile_money" | "bank") => {
    setMethod(newMethod);
    setPhone("");
    setOperator("");
    setAccountNumber("");
    setAccountName("");
    setBankName("");
    setFormErrors({});
    setSubmitError(null);
  };

  const handleSubmit = async (formData: FormData) => {
    setSubmitError(null);

    const currentAmount = formData.get("amount") as string;
    const currentMethod = formData.get("method") as string;
    const currentPhone = formData.get("phone") as string;
    const currentOperator = formData.get("operator") as string;
    const currentAccountNumber = formData.get("accountNumber") as string;
    const currentAccountName = formData.get("accountName") as string;
    const currentBankName = formData.get("bankName") as string;

    const amountErrors: Record<string, string> = {};

    try {
      const amountMinor = decimalStringToMinor(currentAmount, "USD");
      if (amountMinor <= 0n) {
        amountErrors.amount = "Le montant doit être strictement positif.";
      }
    } catch {
      amountErrors.amount = "Format de montant invalide.";
    }

    if (Object.keys(amountErrors).length > 0) {
      setFormErrors(amountErrors);
      return;
    }

    const payout =
      currentMethod === "mobile_money"
        ? { method: "mobile_money" as const, phone: currentPhone, operator: currentOperator }
        : {
            method: "bank" as const,
            account_number: currentAccountNumber,
            account_name: currentAccountName,
            bank_name: currentBankName,
          };

    const result = withdrawalPayoutSchema.safeParse(payout);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[issue.path.join(".")] = issue.message;
      }
      setFormErrors(errors);
      return;
    }

    startTransition(async () => {
      try {
        await requestWithdrawalAction(formData);
        addToast({
          type: "success",
          title: "Demande envoyée",
          description: "Votre demande de retrait a été soumise avec succès.",
        });
        setAmount("");
        setPhone("");
        setOperator("");
        setAccountNumber("");
        setAccountName("");
        setBankName("");
        setFormErrors({});
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setSubmitError(message);
        addToast({ type: "error", title: "Erreur", description: message });
      }
    });
  };

  return (
    <form action={handleSubmit} className="flex flex-col gap-4">
      <InputField
        label="Montant (USD)"
        name="amount"
        type="number"
        step="0.01"
        min="0.01"
        placeholder="30.00"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        required
        description="V1 = USD uniquement. Le montant minimum est de 20,00 USD."
        disabled={isSubmitting}
        error={formErrors.amount ? { message: formErrors.amount } : undefined}
      />

      <input type="hidden" name="currency" value="USD" />

      <SelectField
        label="Méthode de paiement"
        name="method"
        value={method}
        onChange={(e) => handleMethodChange(e.target.value as "mobile_money" | "bank")}
        options={[
          { value: "mobile_money", label: "Mobile Money" },
          { value: "bank", label: "Banque" },
        ]}
        required
        disabled={isSubmitting}
      />

      <input type="hidden" name="method" value={method} />

      {method === "mobile_money" && (
        <>
          <InputField
            label="Numéro de téléphone"
            name="phone"
            type="tel"
            placeholder="+243900000000"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            disabled={isSubmitting}
            error={formErrors.phone ? { message: formErrors.phone } : undefined}
          />
          <InputField
            label="Opérateur"
            name="operator"
            placeholder="ex. Vodacom"
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            required
            disabled={isSubmitting}
            error={formErrors.operator ? { message: formErrors.operator } : undefined}
          />
        </>
      )}

      {method === "bank" && (
        <>
          <InputField
            label="Numéro de compte"
            name="accountNumber"
            type="text"
            placeholder="123456"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            required
            disabled={isSubmitting}
            error={formErrors.account_number ? { message: formErrors.account_number } : undefined}
          />
          <InputField
            label="Nom du titulaire"
            name="accountName"
            type="text"
            placeholder="Jean Dupont"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
            disabled={isSubmitting}
            error={formErrors.account_name ? { message: formErrors.account_name } : undefined}
          />
          <InputField
            label="Nom de la banque"
            name="bankName"
            type="text"
            placeholder="Rawbank"
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            required
            disabled={isSubmitting}
            error={formErrors.bank_name ? { message: formErrors.bank_name } : undefined}
          />
        </>
      )}

      {submitError && (
        <Alert variant="error" title="Erreur">
          {submitError}
        </Alert>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2" size="lg">
        {isSubmitting ? "Envoi en cours…" : "Soumettre la demande"}
      </Button>
    </form>
  );
}
