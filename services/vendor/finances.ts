/**
 * Services financiers vendeur — requêtes côté serveur.
 *
 * Réutilise exclusivement les RPC backend existants :
 *  - get_my_vendor_balances()
 *  - request_withdrawal()
 *  - cancel_my_withdrawal()
 *
 * Le vendorId est injecté côté serveur (jamais par le client).
 * Aucun calcul financier côté frontend.
 */
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { decimalStringToMinor, type CurrencyCode } from "@/lib/money";
import type { SupabaseClient } from "@supabase/supabase-js";

export type FinancesDb = SupabaseClient;

export interface VendorBalance {
  readonly currency: string;
  readonly accountingBalance: string;
  readonly reservedAmount: string;
  readonly availableBalance: string;
}

export interface WithdrawalRecord {
  readonly id: string;
  readonly amount: string;
  readonly currency: string;
  readonly method: string;
  readonly status: string;
  readonly createdAt: string;
  readonly processedAt: string | null;
}

export interface WithdrawalFormData {
  readonly amount: string;
  readonly currency: string;
  readonly method: "mobile_money" | "bank";
  readonly payout: {
    phone?: string;
    operator?: string;
    account_number?: string;
    account_name?: string;
    bank_name?: string;
  };
}

export async function getVendorBalances(): Promise<VendorBalance[]> {
  const supabase = await createSupabaseServerClient();
  const current = await getCurrentProfile();

  if (current.kind !== "ok") {
    throw new Error("Non authentifié");
  }

  try {
    const { data, error } = await supabase.rpc("get_my_vendor_balances");
    if (error !== null) {
      throw new Error(`Impossible de charger les soldes : ${error.message}`);
    }
    return (data ?? []).map(
      (row: {
        currency: string;
        accounting_balance: string;
        reserved_amount: string;
        available_balance: string;
      }) => ({
        currency: row.currency,
        accountingBalance: String(row.accounting_balance),
        reservedAmount: String(row.reserved_amount),
        availableBalance: String(row.available_balance),
      }),
    );
  } catch {
    throw new Error("Impossible de charger les soldes du vendeur.");
  }
}

export async function getVendorWithdrawals(): Promise<WithdrawalRecord[]> {
  const supabase = await createSupabaseServerClient();
  const current = await getCurrentProfile();

  if (current.kind !== "ok") {
    throw new Error("Non authentifié");
  }

  try {
    const { data: vendor } = await supabase
      .from("vendors")
      .select("id")
      .eq("user_id", current.profile.id)
      .maybeSingle();

    if (!vendor) {
      return [];
    }

    const { data, error } = await supabase
      .from("withdrawals")
      .select("id, amount, currency, method, status, created_at, processed_at")
      .eq("vendor_id", vendor.id)
      .order("created_at", { ascending: false });

    if (error !== null) {
      throw new Error(`Impossible de charger l'historique : ${error.message}`);
    }

    return (data ?? []).map((row) => ({
      id: row.id as string,
      amount: String(row.amount),
      currency: row.currency as string,
      method: row.method as string,
      status: row.status as string,
      createdAt: row.created_at as string,
      processedAt: row.processed_at as string | null,
    }));
  } catch {
    throw new Error("Impossible de charger l'historique des retraits.");
  }
}

export async function requestVendorWithdrawal(
  formData: WithdrawalFormData,
): Promise<{ id: string }> {
  const supabase = await createSupabaseServerClient();
  const current = await getCurrentProfile();

  if (current.kind !== "ok") {
    throw new Error("Non authentifié");
  }

  const amountMinor = decimalStringToMinor(formData.amount, formData.currency as CurrencyCode);
  if (amountMinor <= 0n) {
    throw new Error("Le montant doit être strictement positif.");
  }

  const payout = formData.payout;

  try {
    const { data, error } = await supabase.rpc("request_withdrawal", {
      p_currency: formData.currency as string,
      p_amount: formData.amount,
      p_method: formData.method,
      p_payout: payout,
    });

    if (error !== null) {
      const msg = error.message ?? "Erreur inconnue";
      if (msg.includes("Retraits indisponibles")) {
        throw new Error("Retraits indisponibles pour cette devise.");
      }
      if (msg.includes("Montant minimum")) {
        throw new Error(msg);
      }
      if (msg.includes("insuffisant")) {
        throw new Error("Solde disponible insuffisant.");
      }
      if (msg.includes("Structure payout")) {
        throw new Error(msg);
      }
      if (msg.includes("obligatoire")) {
        throw new Error(msg);
      }
      if (msg.includes("Méthode de paiement")) {
        throw new Error(msg);
      }
      throw new Error(msg);
    }

    return { id: data as string };
  } catch {
    throw new Error("Erreur lors de la demande de retrait.");
  }
}

export async function cancelVendorWithdrawal(withdrawalId: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const current = await getCurrentProfile();

  if (current.kind !== "ok") {
    throw new Error("Non authentifié");
  }

  try {
    const { error } = await supabase.rpc("cancel_my_withdrawal", {
      p_withdrawal: withdrawalId,
    });

    if (error !== null) {
      throw new Error(error.message ?? "Impossible d'annuler le retrait.");
    }
  } catch {
    throw new Error("Impossible d'annuler le retrait.");
  }
}

export const CURRENCIES: readonly CurrencyCode[] = ["USD"];
export const SUPPORTED_METHODS = ["mobile_money", "bank"] as const;

export const MOBILE_MONEY_FIELDS = ["phone", "operator"] as const;
export const BANK_FIELDS = ["account_number", "account_name", "bank_name"] as const;

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
