import { type Metadata } from "next";
import { WithdrawalList, type AdminWithdrawalRecord } from "@/app/admin/components/withdrawal-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Retraits vendeurs",
  robots: { index: false, follow: false },
};

function payoutDetails(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};

  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );
}

export default async function AdminWithdrawalsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("withdrawals")
    .select(
      "id, amount, currency, method, payout_details, status, created_at, processed_at, vendor:vendors (store_name, slug)",
    )
    .order("created_at", { ascending: false });

  if (error !== null) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Retraits vendeurs</h1>
        <p className="text-sm text-destructive">Impossible de charger les retraits.</p>
      </div>
    );
  }

  const withdrawals: AdminWithdrawalRecord[] = (data ?? []).map((withdrawal) => ({
    id: withdrawal.id,
    amount: String(withdrawal.amount),
    currency: withdrawal.currency,
    method: withdrawal.method,
    payoutDetails: payoutDetails(withdrawal.payout_details),
    status: withdrawal.status,
    createdAt: withdrawal.created_at,
    processedAt: withdrawal.processed_at,
    vendor: withdrawal.vendor?.[0]
      ? { storeName: withdrawal.vendor[0].store_name, slug: withdrawal.vendor[0].slug }
      : null,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Retraits vendeurs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Contrôlez et traitez les demandes de paiement des vendeurs.
        </p>
      </div>

      <WithdrawalList withdrawals={withdrawals} />
    </div>
  );
}
