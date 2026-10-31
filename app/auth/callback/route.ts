import { NextResponse, type NextRequest } from "next/server";
import { safeInternalPath } from "@/lib/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/env";

/**
 * Callback des liens email (confirmation / réinitialisation).
 * Échange le code d'autorisation contre une session en cookie httpOnly.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = safeInternalPath(nextParam ?? "");

  if (code !== null && code.length > 0) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error === null) {
      return NextResponse.redirect(new URL(next, getAppUrl()));
    }
  }

  return NextResponse.redirect(new URL("/forgot-password?error=invalid_or_expired_link", getAppUrl()));
}
