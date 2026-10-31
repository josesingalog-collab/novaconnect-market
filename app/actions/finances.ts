"use server";

import { requestVendorWithdrawal as requestVendorWithdrawalService } from "@/services/vendor/finances";
import { cancelVendorWithdrawal as cancelVendorWithdrawalService } from "@/services/vendor/finances";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";

export async function requestWithdrawalAction(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  if (await requiresMfaChallenge(supabase)) {
    throw new Error("Vérification en deux étapes requise.");
  }
  const amount = formData.get("amount") as string;
  const currency = formData.get("currency") as string;
  const method = formData.get("method") as "mobile_money" | "bank";
  const phone = formData.get("phone") as string | null;
  const operator = formData.get("operator") as string | null;
  const accountNumber = formData.get("accountNumber") as string | null;
  const accountName = formData.get("accountName") as string | null;
  const bankName = formData.get("bankName") as string | null;

  const payout =
    method === "mobile_money"
      ? { phone: phone ?? "", operator: operator ?? "" }
      : {
          account_number: accountNumber ?? "",
          account_name: accountName ?? "",
          bank_name: bankName ?? "",
        };

  const result = await requestVendorWithdrawalService({
    amount,
    currency,
    method,
    payout,
  });

  revalidatePath("/vendor/finances");
  return result;
}

export async function cancelWithdrawalAction(withdrawalId: string) {
  const supabase = await createSupabaseServerClient();
  if (await requiresMfaChallenge(supabase)) {
    throw new Error("Vérification en deux étapes requise.");
  }
  await cancelVendorWithdrawalService(withdrawalId);
  revalidatePath("/vendor/finances");
}
