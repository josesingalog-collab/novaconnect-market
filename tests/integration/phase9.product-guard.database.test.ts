/**
 * PHASE 9 S1 — Guard produit : vendor_id IMMUTABLE.
 *
 * Couverture :
 *  [T1] vendeur → vendor_id vers sa propre boutique (même vendor) → passé (pas de changement) ;
 *  [T2] vendeur → vendor_id vers boutique d'un autre utilisateur → refus (is_owner) ;
 *  [T3] vendeur → modification title sur DRAFT → autorisée ;
 *  [T4] vendeur → vendor_id + title simultanément → refus ;
 *  [T5] service_role → vendor_id → autorisé (bypass existant) ;
 *  [T6] vendeur → status PUBLISHED → refus ;
 *  [T7] vendeur → category_id sur DRAFT → autorisé (comportement conservé) ;
 *  [T8] vendeur → category_id sur PUBLISHED → refus (comportement conservé).
 *
 * Suite autonome : utilisateurs et données supprimés en fin d'exécution.
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
let vendorAId = "";
let vendorBId = "";
let vendorCId = "";
let categoryId = "";
let adminUserId = "";
let productCounter = 0;

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

async function promoteToVendor(user: User): Promise<string> {
  const slug = `shop-${suffix}-${user.id.slice(0, 8)}`;
  const { data, error } = await service
    .from("vendors")
    .insert({ user_id: user.id, store_name: `Shop ${suffix}`, slug })
    .select("id")
    .single();
  expect(error).toBeNull();
  if (data === null) throw new Error("Boutique non créée");
  return data.id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: cat } = await service
    .from("categories")
    .insert({ name: `Catégorie ${suffix}`, slug: `cat-${suffix}`, is_active: true })
    .select("id")
    .single();
  categoryId = cat?.id ?? "";

  const a = await makeUser("ProdGuardA");
  const b = await makeUser("ProdGuardB");
  const c = await makeUser("ProdGuardC");

  vendorAId = await promoteToVendor(a.user);
  vendorBId = await promoteToVendor(b.user);
  vendorCId = await promoteToVendor(c.user);

  await service.from("vendors").update({ status: "ACTIVE" }).eq("id", vendorAId);
  await service.from("vendors").update({ status: "ACTIVE" }).eq("id", vendorBId);
  await service.from("vendors").update({ status: "ACTIVE" }).eq("id", vendorCId);

  const d = await makeUser("ProdGuardAdmin");
  adminUserId = d.user.id;
  await service.from("profiles").update({ role: "ADMIN" }).eq("id", adminUserId);
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

describe("Phase 9 S1 — Guard produit : vendor_id immuable", () => {
  it("[T1] Vendeur A passe vendor_id à vendorA (aucun changement) → passé", async () => {
    const aClient = await makeClient("ProdGuardA");
    const product = await createProduct(aClient, vendorAId, categoryId);

    // Mettre à jour vendor_id avec la même valeur → la garde passe
    const { error } = await aClient
      .from("products")
      .update({ vendor_id: vendorAId })
      .eq("id", product.id);

    expect(error).toBeNull();
  });

  it("[T2] Vendeur A change vendor_id vers boutique C (autre vendeur) → refus (is_owner)", async () => {
    const aClient = await makeClient("ProdGuardA");
    const product = await createProduct(aClient, vendorAId, categoryId);

    const { error } = await aClient
      .from("products")
      .update({ vendor_id: vendorCId })
      .eq("id", product.id);

    expect(error).not.toBeNull();
    expect((error as { message?: string; code?: string }).message).toContain("Produit non autorise");

    const { data: row } = await service
      .from("products")
      .select("vendor_id")
      .eq("id", product.id)
      .single();
    expect(row?.vendor_id).toBe(vendorAId);
  });

  it("[T3] Vendeur A modifie title sur DRAFT → autorisé", async () => {
    const aClient = await makeClient("ProdGuardA");
    const product = await createProduct(aClient, vendorAId, categoryId);

    const { error } = await aClient
      .from("products")
      .update({ title: `Titre modifié ${suffix}` })
      .eq("id", product.id);

    expect(error).toBeNull();

    const { data: row } = await service
      .from("products")
      .select("title")
      .eq("id", product.id)
      .single();
    expect(row?.title).toBe(`Titre modifié ${suffix}`);
  });

  it("[T4] Vendeur A modifie vendor_id + title simultanément → refus", async () => {
    const aClient = await makeClient("ProdGuardA");
    const product = await createProduct(aClient, vendorAId, categoryId);

    const { error } = await aClient
      .from("products")
      .update({ vendor_id: vendorCId, title: `Tentative ${suffix}` })
      .eq("id", product.id);

    expect(error).not.toBeNull();
    expect((error as { message?: string }).message).toContain("Produit non autorise");

    const { data: row } = await service
      .from("products")
      .select("title")
      .eq("id", product.id)
      .single();
    expect(row?.title).not.toBe(`Tentative ${suffix}`);
  });

  it("[T5] service_role change vendor_id → autorisé (bypass existant)", async () => {
    const product = await createProduct(service, vendorAId, categoryId);

    const { error } = await service
      .from("products")
      .update({ vendor_id: vendorBId })
      .eq("id", product.id);

    expect(error).toBeNull();

    const { data: row } = await service
      .from("products")
      .select("vendor_id")
      .eq("id", product.id)
      .single();
    expect(row?.vendor_id).toBe(vendorBId);
  });

  it("[T6] Vendeur A passe status → PUBLISHED → refus", async () => {
    const aClient = await makeClient("ProdGuardA");
    const product = await createProduct(aClient, vendorAId, categoryId);

    const { error } = await aClient
      .from("products")
      .update({ status: "PUBLISHED" })
      .eq("id", product.id);

    expect(error).not.toBeNull();
    expect((error as { message?: string }).message).toContain("Seule l'administration");

    const { data: row } = await service
      .from("products")
      .select("status")
      .eq("id", product.id)
      .single();
    expect(row?.status).toBe("DRAFT");
  });

  it("[T7] Vendeur A modifie category_id sur DRAFT → autorisé", async () => {
    const aClient = await makeClient("ProdGuardA");
    const product = await createProduct(aClient, vendorAId, categoryId);

    const { data: cat2 } = await service
      .from("categories")
      .insert({ name: `Cat2 ${suffix}`, slug: `cat2-${suffix}-${productCounter++}`, is_active: true })
      .select("id")
      .single();
    const otherCategoryId = cat2?.id ?? "";

    const { error } = await aClient
      .from("products")
      .update({ category_id: otherCategoryId })
      .eq("id", product.id);

    expect(error).toBeNull();
  });

  it("[T8] Vendeur A modifie category_id sur PUBLISHED → refus", async () => {
    const product = await createProduct(service, vendorAId, categoryId);
    await service.from("products").update({ status: "PUBLISHED" }).eq("id", product.id);

    const aClient = await makeClient("ProdGuardA");
    const { data: cat2 } = await service
      .from("categories")
      .insert({ name: `Cat3 ${suffix}`, slug: `cat3-${suffix}-${productCounter++}`, is_active: true })
      .select("id")
      .single();
    const otherCategoryId = cat2?.id ?? "";

    const { error } = await aClient
      .from("products")
      .update({ category_id: otherCategoryId })
      .eq("id", product.id);

    expect(error).not.toBeNull();
  });
});

async function makeClient(name: string): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `${name.toLowerCase()}.${suffix}@example.com`;
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  expect(signInError).toBeNull();
  return client;
}

async function createProduct(
  client: SupabaseClient,
  vendorId: string,
  categoryId: string,
) {
  const slug = `prod-guard-${suffix}-${vendorId.slice(0, 8)}-${productCounter++}`;
  const { data, error } = await client
    .from("products")
    .insert({
      vendor_id: vendorId,
      category_id: categoryId,
      title: `Produit garde ${suffix}`,
      slug,
      short_description: `Description courte ${suffix}`,
      description: `Description longue ${suffix}`,
      price: "10.00",
      currency: "USD",
      status: "DRAFT",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  if (data === null) throw new Error("Produit non créé");
  return data;
}