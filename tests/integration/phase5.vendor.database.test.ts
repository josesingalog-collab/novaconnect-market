/**
 * PHASE 5 — Flux USER → VENDEUR : promotion signée, garde renforcée v2.
 *
 * Couverture :
 *  [T1] création de SA boutique → PENDING + profil VENDOR (status intact) ;
 *  [T2/T3] écriture directe role VENDOR/ADMIN sans boutique → refus ;
 *  [T4] modification du profil d'autrui → RLS filtre silencieusement ;
 *  [T5] status='SUSPENDED' → refus ;
 *  [T9] deuxième boutique → refus unicité 23505 ;
 *  [T10] INSERT avec user_id usurpé → refus policy vendors_insert_own ;
 *  [T-GUC] après promotion, passage à ADMIN toujours refusé ;
 *  [T7] suppression de la boutique du VENDOR → retour BUYER ;
 *  [T8] cycle boutique d'un ADMIN → jamais rétrogradé.
 *
 * Suite autonome : utilisateurs supprimés en fin d'exécution.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const RAW_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const RAW_ANON = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const RAW_SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!RAW_URL || !RAW_ANON || !RAW_SERVICE) {
  throw new Error("Variables Supabase manquantes pour les tests d'intégration.");
}

const URL: string = RAW_URL;
const ANON: string = RAW_ANON;
const SERVICE: string = RAW_SERVICE;

const suffix = Date.now().toString(36);
const PASSWORD = "Passw0rd!Test";

let service: SupabaseClient;
const createdUsers: User[] = [];
let aId = "";
let bId = "";
let dId = "";
let shopAId = "";

async function makeUser(name: string): Promise<{ user: User; client: SupabaseClient }> {
  const email = `${name.toLowerCase()}.${suffix}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
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

async function clientFor(name: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: `${name.toLowerCase()}.${suffix}@example.com`,
    password: PASSWORD,
  });
  expect(error).toBeNull();
  return client;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  for (const n of ["VendorFlowA", "VendorFlowB", "BuyerC", "AdminD"]) {
    const u = await makeUser(n);
    if (n.startsWith("VendorFlowA")) aId = u.user.id;
    if (n.startsWith("VendorFlowB")) bId = u.user.id;
    if (n.startsWith("AdminD")) dId = u.user.id;
  }
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

describe("Phase 5 — Flux vendeur & garde v2", () => {
  it("[T2] BUYER sans boutique : role='VENDOR' en direct → refus", async () => {
    const cClient = await clientFor("BuyerC");
    const uid = (await cClient.auth.getUser()).data.user?.id ?? "";
    const { error } = await cClient.from("profiles").update({ role: "VENDOR" }).eq("id", uid);
    expect(error).not.toBeNull();
  });

  it("[T3] BUYER : role='ADMIN' en direct → refus", async () => {
    const cClient = await clientFor("BuyerC");
    const uid = (await cClient.auth.getUser()).data.user?.id ?? "";
    const { error } = await cClient.from("profiles").update({ role: "ADMIN" }).eq("id", uid);
    expect(error).not.toBeNull();
    const { data } = await service.from("profiles").select("role").eq("id", uid).single();
    expect(data?.role).toBe("BUYER");
  });

  it("[T4] BUYER : modifier le PROFIL B → RLS filtre silencieusement", async () => {
    const aClient = await clientFor("VendorFlowA");
    const { data, error } = await aClient
      .from("profiles")
      .update({ role: "ADMIN", full_name: "Piraté" })
      .eq("id", bId)
      .select("id");

    expect(error).toBeNull(); // pas d'erreur SQL…
    expect(data).toHaveLength(0); // …mais zéro ligne touchée (RLS)

    const { data: bRow } = await service.from("profiles").select("role").eq("id", bId).single();
    expect(bRow?.role).toBe("BUYER");
  });

  it("[T5] BUYER : status='SUSPENDED' → refus (status totalement protégé)", async () => {
    const aClient = await clientFor("VendorFlowA");
    const { error } = await aClient.from("profiles").update({ status: "SUSPENDED" }).eq("id", aId);
    expect(error).not.toBeNull();
  });

  it("[T10] INSERT boutique avec user_id usurpé (profil B) → refus RLS", async () => {
    const aClient = await clientFor("VendorFlowA");
    const { error } = await aClient.from("vendors").insert({
      user_id: bId,
      store_name: `Usurpée ${suffix}`,
      slug: `usurpee-${suffix}`,
    });
    expect(error).not.toBeNull();
  });

  it("[T1] BUYER A crée SA boutique → PENDING + rôle devient VENDOR", async () => {
    const aClient = await clientFor("VendorFlowA");
    const { data, error } = await aClient
      .from("vendors")
      .insert({
        user_id: aId,
        store_name: `Boutique A ${suffix}`,
        slug: `boutique-a-${suffix}`,
      })
      .select("id, status")
      .single();

    expect(error).toBeNull();
    shopAId = data?.id ?? "";
    expect(data?.status).toBe("PENDING");

    const { data: prof } = await service
      .from("profiles")
      .select("role, status")
      .eq("id", aId)
      .single();
    expect(prof?.role).toBe("VENDOR"); // ← promotion automatique signée
    expect(prof?.status).toBe("ACTIVE"); // ← statut intouché par le flux
  });

  it("[T-GUC] Après promotion, role='ADMIN' reste refusé (GUC expiré + transition interdite)", async () => {
    const aClient = await clientFor("VendorFlowA");
    const { error } = await aClient.from("profiles").update({ role: "ADMIN" }).eq("id", aId);
    expect(error).not.toBeNull();
  });

  it("[T9] Deuxième boutique du même utilisateur → refus unicité (23505)", async () => {
    const aClient = await clientFor("VendorFlowA");
    const { error } = await aClient.from("vendors").insert({
      user_id: aId,
      store_name: `Doublon ${suffix}`,
      slug: `doublon-${suffix}`,
    });
    expect(error).not.toBeNull();
    expect((error as { code?: string }).code).toBe("23505");
  });

  it("[T7] Suppression de la boutique du VENDOR A → retour BUYER", async () => {
    const { error } = await service.from("vendors").delete().eq("id", shopAId);
    expect(error).toBeNull();
    const { data } = await service.from("profiles").select("role").eq("id", aId).single();
    expect(data?.role).toBe("BUYER");
  });

  it("[T8][T6] Boutique d'un ADMIN : jamais rétrogradé, seul new.user_id signé", async () => {
    // D promu ADMIN côté serveur (chemin légitime), puis crée SA boutique.
    await service.from("profiles").update({ role: "ADMIN" }).eq("id", dId);
    const dClient = await clientFor("AdminD");
    const { data: shop, error: insErr } = await dClient
      .from("vendors")
      .insert({
        user_id: dId,
        store_name: `Boutique Admin ${suffix}`,
        slug: `admin-shop-${suffix}`,
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();

    // La promotion n'a PAS touché le rôle (condition role='BUYER' non remplie).
    let prof = await readRole(dId);
    expect(prof).toBe("ADMIN");

    // Suppression de la boutique → démission ciblée role='VENDOR' → D reste ADMIN.
    await service.from("vendors").delete().eq("id", shop?.id ?? "");
    prof = await readRole(dId);
    expect(prof).toBe("ADMIN");
  });

  it("[T11] Le vendeur ne peut pas modifier le statut de SA boutique", async () => {
    // A recrée une boutique (redevient VENDOR), puis tente de forcer ACTIVE.
    const aClient = await clientFor("VendorFlowA");
    const { data: shop, error: insErr } = await aClient
      .from("vendors")
      .insert({
        user_id: aId,
        store_name: `Boutique Statut ${suffix}`,
        slug: `statut-shop-${suffix}`,
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();

    const { error } = await aClient
      .from("vendors")
      .update({ status: "ACTIVE" })
      .eq("id", shop?.id ?? "");
    // Refusé : policy insert-only PENDING + guard_vendor_sensitive sur UPDATE.
    expect(error).not.toBeNull();
    const { data: row } = await service
      .from("vendors")
      .select("status")
      .eq("id", shop?.id ?? "")
      .single();
    expect(row?.status).toBe("PENDING");

    await service.from("vendors").delete().eq("id", shop?.id ?? "");
  });

  async function readRole(profileId: string): Promise<string | null | undefined> {
    const { data } = await service.from("profiles").select("role").eq("id", profileId).single();
    return data?.role;
  }
});
