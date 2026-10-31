"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { transitionAdminWithdrawalAction } from "@/app/actions/admin-withdrawals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WITHDRAWAL_STATUS_LABELS } from "@/constants/withdrawal";
import type { AdminWithdrawalTransition } from "@/services/admin/withdrawals";

export interface AdminWithdrawalRecord {
  id: string;
  amount: string;
  currency: string;
  method: string;
  payoutDetails: Record<string, string>;
  status: string;
  createdAt: string;
  processedAt: string | null;
  vendor: { storeName: string; slug: string } | null;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function payoutLabel(withdrawal: AdminWithdrawalRecord): string {
  if (withdrawal.method === "mobile_money") {
    return [withdrawal.payoutDetails.phone, withdrawal.payoutDetails.operator]
      .filter(Boolean)
      .join(" · ");
  }

  return [
    withdrawal.payoutDetails.account_number,
    withdrawal.payoutDetails.account_name,
    withdrawal.payoutDetails.bank_name,
  ]
    .filter(Boolean)
    .join(" · ");
}

function nextAction(
  status: string,
): { transition: AdminWithdrawalTransition; label: string } | null {
  if (status === "PENDING") return { transition: "approve", label: "Approuver" };
  if (status === "APPROVED") return { transition: "process", label: "Traiter" };
  if (status === "PROCESSING") return { transition: "pay", label: "Marquer payé" };
  return null;
}

export function WithdrawalList({ withdrawals }: { withdrawals: AdminWithdrawalRecord[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transition = (withdrawalId: string, action: AdminWithdrawalTransition) => {
    setError(null);
    setPendingId(withdrawalId);
    startTransition(async () => {
      const result = await transitionAdminWithdrawalAction(withdrawalId, action);
      setPendingId(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (withdrawals.length === 0) {
    return (
      <EmptyState
        icon={
          <span className="text-3xl" aria-hidden="true">
            $
          </span>
        }
        title="Aucun retrait"
        description="Aucune demande de retrait n'a encore été soumise."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="error" title="Erreur">
          {error}
        </Alert>
      )}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendeur</TableHead>
                <TableHead>Montant</TableHead>
                <TableHead>Versement</TableHead>
                <TableHead>Demandé le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {withdrawals.map((withdrawal) => (
                <WithdrawalRow
                  key={withdrawal.id}
                  withdrawal={withdrawal}
                  pending={pendingId === withdrawal.id}
                  onTransition={transition}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 p-4 md:hidden">
          {withdrawals.map((withdrawal) => (
            <WithdrawalCard
              key={withdrawal.id}
              withdrawal={withdrawal}
              pending={pendingId === withdrawal.id}
              onTransition={transition}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function WithdrawalRow({
  withdrawal,
  pending,
  onTransition,
}: {
  withdrawal: AdminWithdrawalRecord;
  pending: boolean;
  onTransition: (withdrawalId: string, action: AdminWithdrawalTransition) => void;
}) {
  const action = nextAction(withdrawal.status);
  const status = WITHDRAWAL_STATUS_LABELS[withdrawal.status];

  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-foreground">
          {withdrawal.vendor?.storeName ?? "Boutique supprimée"}
        </div>
        <div className="text-xs text-muted-foreground">{withdrawal.vendor?.slug ?? "—"}</div>
      </TableCell>
      <TableCell className="font-medium text-foreground">
        {withdrawal.amount} {withdrawal.currency}
      </TableCell>
      <TableCell>
        <div className="text-sm text-foreground">
          {withdrawal.method === "mobile_money" ? "Mobile Money" : "Banque"}
        </div>
        <div className="max-w-64 truncate text-xs text-muted-foreground">
          {payoutLabel(withdrawal) || "—"}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(withdrawal.createdAt)}</TableCell>
      <TableCell>
        <Badge variant={status?.variant ?? "secondary"}>{status?.label ?? withdrawal.status}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <WithdrawalButtons
          withdrawal={withdrawal}
          action={action}
          pending={pending}
          onTransition={onTransition}
        />
      </TableCell>
    </TableRow>
  );
}

function WithdrawalCard({
  withdrawal,
  pending,
  onTransition,
}: {
  withdrawal: AdminWithdrawalRecord;
  pending: boolean;
  onTransition: (withdrawalId: string, action: AdminWithdrawalTransition) => void;
}) {
  const status = WITHDRAWAL_STATUS_LABELS[withdrawal.status];
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">
            {withdrawal.vendor?.storeName ?? "Boutique supprimée"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {withdrawal.amount} {withdrawal.currency}
          </p>
        </div>
        <Badge variant={status?.variant ?? "secondary"}>{status?.label ?? withdrawal.status}</Badge>
      </div>
      <p className="mt-3 text-sm text-foreground">
        {withdrawal.method === "mobile_money" ? "Mobile Money" : "Banque"}
      </p>
      <p className="text-xs text-muted-foreground">{payoutLabel(withdrawal) || "—"}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Demandé le {formatDate(withdrawal.createdAt)}
      </p>
      <div className="mt-4">
        <WithdrawalButtons
          withdrawal={withdrawal}
          action={nextAction(withdrawal.status)}
          pending={pending}
          onTransition={onTransition}
        />
      </div>
    </div>
  );
}

function WithdrawalButtons({
  withdrawal,
  action,
  pending,
  onTransition,
}: {
  withdrawal: AdminWithdrawalRecord;
  action: { transition: AdminWithdrawalTransition; label: string } | null;
  pending: boolean;
  onTransition: (withdrawalId: string, action: AdminWithdrawalTransition) => void;
}) {
  if (withdrawal.status === "PENDING") {
    return (
      <div className="flex justify-end gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={pending}
          onClick={() => onTransition(withdrawal.id, "approve")}
        >
          {pending ? "Mise à jour..." : "Approuver"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => onTransition(withdrawal.id, "reject")}
        >
          Rejeter
        </Button>
      </div>
    );
  }

  if (action === null)
    return <span className="text-xs text-muted-foreground">Aucune action disponible</span>;
  return (
    <Button
      variant={action.transition === "pay" ? "success" : "primary"}
      size="sm"
      disabled={pending}
      onClick={() => onTransition(withdrawal.id, action.transition)}
    >
      {pending ? "Mise à jour..." : action.label}
    </Button>
  );
}
