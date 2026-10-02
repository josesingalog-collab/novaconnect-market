"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cancelWithdrawalAction } from "@/app/actions/finances";
import { WITHDRAWAL_STATUS_LABELS } from "@/constants/withdrawal";
import type { WithdrawalRecord } from "@/services/vendor/finances";

interface WithdrawalActionsProps {
  withdrawal: WithdrawalRecord;
  onCancel?: () => void;
}

export function WithdrawalActions({ withdrawal, onCancel }: WithdrawalActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canCancel = withdrawal.status === "PENDING";

  const handleCancel = async () => {
    if (!canCancel) return;
    setError(null);
    startTransition(async () => {
      try {
        await cancelWithdrawalAction(withdrawal.id);
        onCancel?.();
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erreur inconnue";
        setError(message);
      }
    });
  };

  const statusInfo = WITHDRAWAL_STATUS_LABELS[withdrawal.status] ?? {
    label: withdrawal.status,
    variant: "secondary" as const,
  };

  return (
    <Card variant="bordered" className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-foreground">
                {withdrawal.amount} {withdrawal.currency}
              </span>
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Méthode : {withdrawal.method === "mobile_money" ? "Mobile Money" : "Banque"}
            </p>
            <p className="text-xs text-muted-foreground">
              {new Date(withdrawal.createdAt).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            {error && (
              <Alert variant="error" className="mt-2">
                {error}
              </Alert>
            )}
          </div>
          <div className="shrink-0">
            {canCancel ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={isPending}
                className="min-h-[44px]"
              >
                {isPending ? "Annulation…" : "Annuler"}
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">Annulation non disponible</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
