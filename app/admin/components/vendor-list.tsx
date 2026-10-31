"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { transitionAdminVendorAction } from "@/app/actions/admin-vendors";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminVendorTransition } from "@/services/admin/vendors";

export interface AdminVendorRecord {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  status: string;
  createdAt: string;
}

const STATUS: Record<
  string,
  { label: string; variant: "warning" | "success" | "info" | "destructive" }
> = {
  PENDING: { label: "En attente", variant: "warning" },
  ACTIVE: { label: "Active", variant: "success" },
  SUSPENDED: { label: "Suspendue", variant: "destructive" },
  REJECTED: { label: "Refusée", variant: "info" },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VendorList({ vendors }: { vendors: AdminVendorRecord[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const transition = (vendorId: string, action: AdminVendorTransition) => {
    setError(null);
    setPendingId(vendorId);
    startTransition(async () => {
      const result = await transitionAdminVendorAction(vendorId, action);
      setPendingId(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  };

  if (vendors.length === 0) {
    return (
      <EmptyState
        icon={
          <span className="text-3xl" aria-hidden="true">
            V
          </span>
        }
        title="Aucune boutique"
        description="Aucune boutique vendeur n'a encore été créée."
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
                <TableHead>Boutique</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Créée le</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {vendors.map((vendor) => (
                <VendorRow
                  key={vendor.id}
                  vendor={vendor}
                  pending={pendingId === vendor.id}
                  onTransition={transition}
                />
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 p-4 md:hidden">
          {vendors.map((vendor) => (
            <VendorCard
              key={vendor.id}
              vendor={vendor}
              pending={pendingId === vendor.id}
              onTransition={transition}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function VendorRow({
  vendor,
  pending,
  onTransition,
}: {
  vendor: AdminVendorRecord;
  pending: boolean;
  onTransition: (vendorId: string, action: AdminVendorTransition) => void;
}) {
  const status = STATUS[vendor.status];
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium text-foreground">{vendor.storeName}</div>
        <div className="text-xs text-muted-foreground">{vendor.slug}</div>
      </TableCell>
      <TableCell className="max-w-80 truncate text-muted-foreground">
        {vendor.description || "—"}
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(vendor.createdAt)}</TableCell>
      <TableCell>
        <Badge variant={status?.variant ?? "info"}>{status?.label ?? vendor.status}</Badge>
      </TableCell>
      <TableCell className="text-right">
        <VendorButtons vendor={vendor} pending={pending} onTransition={onTransition} />
      </TableCell>
    </TableRow>
  );
}

function VendorCard({
  vendor,
  pending,
  onTransition,
}: {
  vendor: AdminVendorRecord;
  pending: boolean;
  onTransition: (vendorId: string, action: AdminVendorTransition) => void;
}) {
  const status = STATUS[vendor.status];
  return (
    <div className="rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-medium text-foreground">{vendor.storeName}</h2>
          <p className="text-sm text-muted-foreground">{vendor.slug}</p>
        </div>
        <Badge variant={status?.variant ?? "info"}>{status?.label ?? vendor.status}</Badge>
      </div>
      {vendor.description && (
        <p className="mt-3 text-sm text-muted-foreground">{vendor.description}</p>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Créée le {formatDate(vendor.createdAt)}</p>
      <div className="mt-4">
        <VendorButtons vendor={vendor} pending={pending} onTransition={onTransition} />
      </div>
    </div>
  );
}

function VendorButtons({
  vendor,
  pending,
  onTransition,
}: {
  vendor: AdminVendorRecord;
  pending: boolean;
  onTransition: (vendorId: string, action: AdminVendorTransition) => void;
}) {
  if (vendor.status === "PENDING") {
    return (
      <div className="flex justify-end gap-2">
        <Button
          variant="success"
          size="sm"
          disabled={pending}
          onClick={() => onTransition(vendor.id, "approve")}
        >
          {pending ? "Mise à jour..." : "Approuver"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={pending}
          onClick={() => onTransition(vendor.id, "reject")}
        >
          Refuser
        </Button>
      </div>
    );
  }

  if (vendor.status === "ACTIVE") {
    return (
      <Button
        variant="destructive"
        size="sm"
        disabled={pending}
        onClick={() => onTransition(vendor.id, "suspend")}
      >
        {pending ? "Mise à jour..." : "Suspendre"}
      </Button>
    );
  }

  if (vendor.status === "SUSPENDED") {
    return (
      <Button
        variant="success"
        size="sm"
        disabled={pending}
        onClick={() => onTransition(vendor.id, "reactivate")}
      >
        {pending ? "Mise à jour..." : "Réactiver"}
      </Button>
    );
  }

  return <span className="text-xs text-muted-foreground">Aucune action disponible</span>;
}
