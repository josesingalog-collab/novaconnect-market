import { z } from "zod";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const withdrawalIdSchema = z.uuid();

export type AdminWithdrawalTransition = "approve" | "process" | "pay" | "reject";

const TRANSITION_RPC: Record<AdminWithdrawalTransition, string> = {
  approve: "approve_withdrawal",
  process: "process_withdrawal",
  pay: "mark_withdrawal_paid",
  reject: "reject_withdrawal",
};

export async function transitionAdminWithdrawal(
  withdrawalId: string,
  transition: AdminWithdrawalTransition,
): Promise<void> {
  if (!withdrawalIdSchema.safeParse(withdrawalId).success) {
    throw new Error("Identifiant de retrait invalide.");
  }

  const current = await getCurrentProfile();
  if (
    current.kind !== "ok" ||
    current.profile.role !== "ADMIN" ||
    current.profile.status !== "ACTIVE"
  ) {
    throw new Error("Accès administrateur requis.");
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(TRANSITION_RPC[transition], {
    p_withdrawal: withdrawalId,
  });

  if (error !== null) {
    throw new Error(error.message || "Impossible de mettre à jour le retrait.");
  }
}
