export const WITHDRAWAL_STATUS_LABELS: Record<
  string,
  { label: string; variant: "warning" | "success" | "info" | "destructive" | "secondary" }
> = {
  PENDING: { label: "En attente", variant: "warning" },
  APPROVED: { label: "Approuvé", variant: "info" },
  PROCESSING: { label: "En traitement", variant: "info" },
  PAID: { label: "Payé", variant: "success" },
  REJECTED: { label: "Rejeté", variant: "destructive" },
  CANCELLED: { label: "Annulé", variant: "secondary" },
};
