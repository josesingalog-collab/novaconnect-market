/**
 * TESTS D'INTÉGRATION PHASE 3 — changement de mot de passe (auth, hors RLS).
 *
 * Scénarios :
 *  1. updateUser(password) avec session valide → ancien mot de passe refusé,
 *     nouveau accepté ;
 *  2. updateUser sans session → erreur (pas de changement anonyme).
 *
 * Suite autonome : les utilisateurs sont supprimés en fin d'exécution.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const RAW_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const RAW_ANON = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const RAW_SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (
  RAW_URL === undefined ||
  RAW_ANON === undefined ||
  RAW_SERVICE === undefined ||
  RAW_URL.length === 0
) {
  throw new Error("Variables Supabase manquantes pour les tests d'intégration.");
}

const URL: string = RAW_URL;
const ANON: string = RAW_ANON;
const SERVICE: string = RAW_SERVICE;

const suffix = Date.now().toString(36);
const OLD_PASSWORD = "Passw0rd!Old";
const NEW_PASSWORD = "Passw0rd!New";

let service: SupabaseClient;
const createdUsers: User[] = [];

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}, 30_000);

afterAll(async () => {
  for (const id of [...createdUsers].reverse()) {
    try {
      await service.auth.admin.deleteUser(id.id);
    } catch {
      // best-effort cleanup
    }
  }
}, 30_000);

describe("Phase 3 — Changement de mot de passe", () => {
  it("change le mot de passe avec une session valide puis invalide l'ancien", async () => {
    const email = `pwdchange.${suffix}@example.com`;
    const { data: created, error: createError } = await service.auth.admin.createUser({
      email,
      password: OLD_PASSWORD,
      email_confirm: true,
    });
    expect(createError).toBeNull();
    if (created.user === null) throw new Error("Utilisateur non créé");
    createdUsers.push(created.user);

    const client = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await client.auth.signInWithPassword({
      email,
      password: OLD_PASSWORD,
    });
    expect(signInError).toBeNull();

    // Même appel que l'action serveur : auth.updateUser via session cookie.
    const { error: updateError } = await client.auth.updateUser({
      password: NEW_PASSWORD,
    });
    expect(updateError).toBeNull();

    const { error: oldLoginError } = await client.auth.signInWithPassword({
      email,
      password: OLD_PASSWORD,
    });
    expect(oldLoginError).not.toBeNull();

    const { error: newLoginError } = await client.auth.signInWithPassword({
      email,
      password: NEW_PASSWORD,
    });
    expect(newLoginError).toBeNull();
  });

  it("refuse le changement sans session authentifiée", async () => {
    const anonymous = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await anonymous.auth.updateUser({ password: "Passw0rd!Ghost" });

    expect(error).not.toBeNull();
  });
});
