import type { createSupabaseServerClient } from "@/lib/supabase/server";

/** True only when the account enrolled MFA but the current session is not AAL2. */
export async function requiresMfaChallenge(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<boolean> {
  const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  return data?.currentLevel === "aal1" && data.nextLevel === "aal2";
}
