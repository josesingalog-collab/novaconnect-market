"use client";

import { ToastProvider, ToastContainer, useToast } from "@/components/ui/toast";
import { WithdrawalForm } from "./withdrawal-form";
import { WithdrawalActions } from "./withdrawal-actions";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { WithdrawalRecord } from "@/services/vendor/finances";

interface FinancesClientProps {
  balances: Array<{
    currency: string;
    accountingBalance: string;
    reservedAmount: string;
    availableBalance: string;
  }>;
  balancesError: boolean;
  withdrawals: WithdrawalRecord[];
  withdrawalsError: boolean;
  usdBalance:
    | {
        currency: string;
        accountingBalance: string;
        reservedAmount: string;
        availableBalance: string;
      }
    | undefined;
}

function BalancesSection({
  balances,
  balancesError,
}: {
  balances: FinancesClientProps["balances"];
  balancesError: boolean;
}) {
  if (balancesError) {
    return (
      <Alert variant="error" title="Erreur de chargement">
        Impossible de charger les soldes. Réessayez plus tard.
      </Alert>
    );
  }

  if (balances.length === 0) {
    return (
      <EmptyState
        title="Aucun solde disponible"
        description="Vos soldes apparaîtront ici une fois que vous aurez des revenus."
      />
    );
  }

  return (
    <section aria-label="Soldes">
      <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
        Mes soldes
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {balances.map((b) => (
          <Card key={b.currency} variant="bordered">
            <CardContent className="pt-6">
              <p className="text-sm font-medium text-muted-foreground">{b.currency}</p>
              <p className="mt-1 text-2xl font-bold text-foreground">
                {b.availableBalance} {b.currency}
              </p>
              <div className="mt-3 flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">
                  Comptable : {b.accountingBalance} {b.currency}
                </p>
                <p className="text-xs text-muted-foreground">
                  Réservé : {b.reservedAmount} {b.currency}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function WithdrawalsList({
  withdrawals,
  withdrawalsError,
  onCancel,
}: {
  withdrawals: WithdrawalRecord[];
  withdrawalsError: boolean;
  onCancel?: () => void;
}) {
  if (withdrawalsError) {
    return (
      <div
        className="rounded-lg border border-destructive bg-destructive/5 p-4 text-sm text-destructive"
        role="alert"
      >
        Impossible de charger l&apos;historique des retraits.
      </div>
    );
  }

  if (withdrawals.length === 0) {
    return (
      <EmptyState title="Aucun retrait" description="Vos demandes de retrait apparaîtront ici." />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {withdrawals.map((w) => (
        <WithdrawalActions key={w.id} withdrawal={w} onCancel={onCancel} />
      ))}
    </div>
  );
}

function FinancesContent(props: FinancesClientProps) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const { addToast } = useToast();

  const handleCancel = async () => {
    startTransition(() => {
      router.refresh();
    });
    addToast({
      type: "success",
      title: "Retrait annulé",
      description: "La demande a été annulée avec succès.",
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <BalancesSection balances={props.balances} balancesError={props.balancesError} />

      <Card variant="bordered">
        <CardContent className="pt-6">
          <WithdrawalForm />
        </CardContent>
      </Card>

      <section aria-label="Historique des retraits">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Historique des retraits
        </h2>
        <WithdrawalsList
          withdrawals={props.withdrawals}
          withdrawalsError={props.withdrawalsError}
          onCancel={handleCancel}
        />
      </section>

      <ToastContainer />
    </div>
  );
}

export function FinancesClient(props: FinancesClientProps) {
  return (
    <ToastProvider>
      <FinancesContent {...props} />
    </ToastProvider>
  );
}
