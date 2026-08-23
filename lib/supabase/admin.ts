/**
 * ⚠️ CLIENT SERVICE-ROLE — SERVEUR UNIQUEMENT. ⚠️
 *
 * Contourne TOUTE politique RLS : à réserver aux contextes système de confiance
 * (webhooks de paiement validés, jobs internes). JAMAIS dans une action
 * déclenchée par un utilisateur classique quand un client RLS suffit.
 *
 * Garde-fous en place :
 *  - import "server-only" → erreur de build si importé depuis le bundle client ;
 *  - règle ESLint no-restricted-imports → interdit tout autre import du module.
 *
 * Ce fichier est le SEUL endroit autorisé à importer ce client.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/env";

let cachedAdminClient: SupabaseClient | null = null;

export function createSupabaseAdminClient(): SupabaseClient {
  const { NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getServerEnv();

  if (cachedAdminClient === null) {
    cachedAdminClient = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }
  return cachedAdminClient;
}
