/**
 * TESTS D'INTÉGRATION PHASE 3 — édition du profil (RLS + garde PostgreSQL)
 * et upload d'avatar Storage.
 *
 * Scénarios :
 *  1. modification de SON propre profil (full_name / phone / avatar_url) autorisée ;
 *  2. modification du profil d'un AUTRE utilisateur bloquée par la RLS ;
 *  3. `role` et `status` impossibles à modifier via l'API (garde PostgreSQL) ;
 *  4. avatar : envoi dans SON dossier Storage autorisé, URL publique servie ;
 *  5. avatar : écriture dans le dossier d'un AUTRE utilisateur refusée ;
 *  6. avatar : ré-envoi au même chemin = remplacement (upsert), pas de doublon.
 *
 * Les utilisateurs de test sont supprimés en fin de suite (cascade complète).
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
const PASSWORD = "Passw0rd!Test";

let service: SupabaseClient;
const createdUsers: User[] = [];
let alice: SupabaseClient;
let bob: SupabaseClient;
let aliceId = "";
let bobId = "";

async function makeUser(fullName: string): Promise<{ user: User; client: SupabaseClient }> {
  const email = `${fullName.toLowerCase()}.${suffix}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  expect(error).toBeNull();
  if (data.user === null) throw new Error("Utilisateur non créé");
  createdUsers.push(data.user);

  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  expect(signInError).toBeNull();
  return { user: data.user, client };
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const a = await makeUser(`Alice${suffix}`);
  aliceId = a.user.id;
  alice = a.client;

  const b = await makeUser(`Bob${suffix}`);
  bobId = b.user.id;
  bob = b.client;
}, 60_000);

afterAll(async () => {
  for (const id of [...createdUsers].reverse()) {
    try {
      await service.auth.admin.deleteUser(id.id);
    } catch {
      // best-effort cleanup
    }
  }
}, 60_000);

describe("Phase 3 — Édition du profil", () => {
  it("autorise la modification de son propre profil", async () => {
    const { data, error } = await alice
      .from("profiles")
      .update({
        full_name: `Alice Modifiée ${suffix}`,
        phone: "+243 999 111 222",
        avatar_url: "https://cdn.example.com/alice.png",
      })
      .eq("id", aliceId)
      .select("full_name, phone, avatar_url")
      .single();

    expect(error).toBeNull();
    expect(data?.full_name).toBe(`Alice Modifiée ${suffix}`);
    expect(data?.phone).toBe("+243 999 111 222");
    expect(data?.avatar_url).toBe("https://cdn.example.com/alice.png");

    // Relecture pour confirmer la persistance.
    const { data: reread, error: readError } = await alice
      .from("profiles")
      .select("full_name, phone")
      .eq("id", aliceId)
      .single();

    expect(readError).toBeNull();
    expect(reread?.phone).toBe("+243 999 111 222");
  });

  it("bloque la modification du profil d'un autre utilisateur (RLS)", async () => {
    const { data, error } = await alice
      .from("profiles")
      .update({ full_name: "Piraté !" })
      .eq("id", bobId)
      .select("id");

    // La RLS filtre silencieusement : pas d'erreur SQL, mais zéro ligne touchée.
    expect(error).toBeNull();
    expect(data).toHaveLength(0);

    const { data: bobRow } = await bob
      .from("profiles")
      .select("full_name")
      .eq("id", bobId)
      .single();

    expect(bobRow?.full_name).toBe(`Bob${suffix}`);
  });

  it("interdit la modification de role ou status via l'API (garde PostgreSQL)", async () => {
    const { error } = await alice
      .from("profiles")
      .update({ role: "ADMIN", status: "SUSPENDED" })
      .eq("id", aliceId);

    expect(error).not.toBeNull();

    const { data: row } = await alice
      .from("profiles")
      .select("role, status")
      .eq("id", aliceId)
      .single();

    expect(row?.role).toBe("BUYER");
    expect(row?.status).toBe("ACTIVE");
  });
});

describe("Phase 3 — Avatar Storage", () => {
  // PNG 1×1 valide (signature binaire authentique).
  const PNG_BYTES = new Uint8Array(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      "base64",
    ),
  );

  it("autorise l'envoi de l'avatar dans son propre dossier et sert l'URL publique", async () => {
    const path = `${aliceId}/avatar.png`;

    const { error } = await alice.storage
      .from("avatars")
      .upload(path, PNG_BYTES, { contentType: "image/png", upsert: true });

    expect(error).toBeNull();

    const { data } = alice.storage.from("avatars").getPublicUrl(path);

    const response = await fetch(data.publicUrl);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");

    // L'URL publique est enregistrable dans profiles.avatar_url (RLS update self).
    const { data: row, error: rowError } = await alice
      .from("profiles")
      .update({ avatar_url: data.publicUrl })
      .eq("id", aliceId)
      .select("avatar_url")
      .single();

    expect(rowError).toBeNull();
    expect(row?.avatar_url).toBe(data.publicUrl);
  });

  it("refuse l'écriture dans le dossier d'un autre utilisateur", async () => {
    const path = `${bobId}/avatar.png`;

    const { error } = await alice.storage
      .from("avatars")
      .upload(path, PNG_BYTES, { contentType: "image/png", upsert: true });

    expect(error).not.toBeNull();
  });

  it("remplace l'avatar existant au même chemin (upsert, pas de doublon)", async () => {
    const path = `${aliceId}/avatar.png`;

    const { error: firstError } = await alice.storage
      .from("avatars")
      .upload(path, PNG_BYTES, { contentType: "image/png", upsert: true });
    expect(firstError).toBeNull();

    const biggerPng = new Uint8Array(PNG_BYTES.length + 1);
    biggerPng.set(PNG_BYTES, 0);
    const { error: secondError } = await alice.storage
      .from("avatars")
      .upload(path, biggerPng, { contentType: "image/png", upsert: true });
    expect(secondError).toBeNull();

    const { data: objects } = await alice.storage.from("avatars").list(aliceId);
    const avatarFiles = (objects ?? []).filter((o) => o.name.startsWith("avatar."));

    expect(avatarFiles).toHaveLength(1);
  });
});
