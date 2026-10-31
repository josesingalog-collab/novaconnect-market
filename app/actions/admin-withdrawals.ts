"use server";

import { revalidatePath } from "next/cache";
import {
  transitionAdminWithdrawal,
  type AdminWithdrawalTransition,
} from "@/services/admin/withdrawals";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";

export interface AdminWithdrawalActionState {
  success: boolean;
  error: string | null;
}

export async function transitionAdminWithdrawalAction(
  withdrawalId: string,
  transition: AdminWithdrawalTransition,
): Promise<AdminWithdrawalActionState> {
  try {
    const supabase = await createSupabaseServerClient();
    if (await requiresMfaChallenge(supabase)) {
      return { success: false, error: "Vérification en deux étapes requise." };
    }
    await transitionAdminWithdrawal(withdrawalId, transition);
    revalidatePath("/admin/retraits");
    return { success: true, error: null };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Impossible de mettre à jour le retrait.",
    };
  }
}
