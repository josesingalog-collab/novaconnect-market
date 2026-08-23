/**
 * Client Supabase SERVEUR (cookies + clé anon).
 * La RLS PostgreSQL reste active : ce client n'élève jamais de privilèges.
 * Utilisé dans les Server Components et Server Actions.
 *
 * Pour les opérations financières système (webhooks), utiliser
 * lib/supabase/admin.ts — import restreint par règle ESLint.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getPublicEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();
  const cookieStore = await cookies();

  return createServerClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Dans un Server Component, l'écriture de cookies est interdite :
        // seuls les Server Actions / Route Handlers peuvent muter la session.
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Contexte lecture seule (RSC) : ignoré volontairement.
        }
      },
    },
  });
}
