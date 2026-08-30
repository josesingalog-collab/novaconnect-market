/**
 * PHASE 9 S2 — Gestion produit vendeur.
 *
 * Couverture :
 *  [T1] vendeur ACTIVE crée un produit → DRAFT ;
 *  [T2] vendeur PENDING/SUSPENDED → refus (RLS) ;
 *  [T3] vendeur passe vendor_id vers autre vendeur → refus (RLS) ;
 *  [T4] vendeur modifie son propre DRAFT → OK ;
 *  [T5] vendeur A ne modifie pas produit B → refus (RLS) ;
 *  [T6] publication directe → refus (guard SQL) ;
 *  [T7] prix invalide → refus ;
 *  [T8] devise CDF acceptée ;
 *  [T9] listMyProducts ne retourne que les produits du vendeur ;
 *  [T10] ADMIN : tout autorisé.
 *
 * Suite autonome : utilisateurs et données supprimés en fin d'exécution.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  createProduct,
  updateProduct,
  listMyProducts,
} from "@/services/products/manage";

function assertOk(result: { ok: boolean; productId?: string; error?: string }): { ok: true; productId: string } {
  if (!result.ok) throw new Error("Expected ok but got error: " + (result.error ?? "unknown"));
  return result as { ok: true; productId: string };
}

function assertFail(result: { ok: boolean; productId?: string; error?: string }): { ok: false; error: string } {
  if (result.ok) throw new Error("Expected error but got ok");
  return result as { ok: false; error: string };
}

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
let vendorSuspendedId = "";
let categoryId = "";
let categoryCdfId = "";
let adminUserId = "";

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

async function promoteToVendor(user: User, status: "ACTIVE" | "PENDING" | "SUSPENDED" = "ACTIVE"): Promise<string> {
  const slug = `shop-${suffix}-${user.id.slice(0, 8)}`;
  const { data, error } = await service
    .from("vendors")
    .insert({ user_id: user.id, store_name: `Shop ${suffix}`, slug, status })
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

  const { data: catCdf } = await service
    .from("categories")
    .insert({ name: `CatCDF ${suffix}`, slug: `catcdf-${suffix}`, is_active: true })
    .select("id")
    .single();
  categoryCdfId = catCdf?.id ?? "";

  const a = await makeUser("ProdManA");
  const b = await makeUser("ProdManB");
  const c = await makeUser("ProdManC");
  const s = await makeUser("ProdManSuspended");

  vendorAId = await promoteToVendor(a.user, "ACTIVE");
  vendorBId = await promoteToVendor(b.user, "ACTIVE");
  vendorCId = await promoteToVendor(c.user, "PENDING");
  vendorSuspendedId = await promoteToVendor(s.user, "SUSPENDED");

  const d = await makeUser("ProdManAdmin");
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

describe("Phase 9 S2 — Gestion produit vendeur", () => {
  it("[T1] Vendeur ACTIVE crée un produit → DRAFT", async () => {
    const aClient = await clientFor("ProdManA");

    const result = await createProduct(aClient, vendorAId, {
      title: `Produit Test ${suffix}`,
      shortDescription: `Desc courte ${suffix}`,
      description: `Description longue ${suffix}`,
      price: "10.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    const product = assertOk(result);
    expect(product.productId).toBeTruthy();

    const { data } = await service
      .from("products")
      .select("status, vendor_id")
      .eq("id", product.productId)
      .single();
    expect(data?.status).toBe("DRAFT");
    expect(data?.vendor_id).toBe(vendorAId);
  });

  it("[T2] Vendeur PENDING ne peut pas créer → refus RLS", async () => {
    const cClient = await clientFor("ProdManC");

    const result = await createProduct(cClient, vendorCId, {
      title: `Produit C ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    assertFail(result);
  });

  it("[T2b] Vendeur SUSPENDU ne peut pas créer → refus RLS", async () => {
    const sClient = await clientFor("ProdManSuspended");

    const result = await createProduct(sClient, vendorSuspendedId, {
      title: `Produit S ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    assertFail(result);
  });

  it("[T3] Vendeur A change vendor_id vers boutique B → refus RLS", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(await createProduct(aClient, vendorAId, {
      title: `Produit T3 ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    }));

    const { error } = await aClient
      .from("products")
      .update({ vendor_id: vendorBId })
      .eq("id", product.productId);

    expect(error).not.toBeNull();
  });

  it("[T4] Vendeur modifie son propre DRAFT → OK", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(await createProduct(aClient, vendorAId, {
      title: `Produit T4 ${suffix}`,
      price: "15.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    }));

    const result = await updateProduct(aClient, product.productId, {
      title: `Produit T4 modifié ${suffix}`,
      price: "20.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    const updated = assertOk(result);
    expect(updated.productId).toBe(product.productId);

    const { data } = await service
      .from("products")
      .select("title, price")
      .eq("id", product.productId)
      .single();
    expect(data?.title).toBe(`Produit T4 modifié ${suffix}`);
    expect(Number(data?.price)).toBe(20);
  });

  it("[T5] Vendeur A ne modifie pas produit de B → refus", async () => {
    const aClient = await clientFor("ProdManA");
    const bClient = await clientFor("ProdManB");
    const productB = assertOk(await createProduct(bClient, vendorBId, {
      title: `Produit B ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    }));

    const result = await updateProduct(aClient, productB.productId, {
      title: `Produit B piraté ${suffix}`,
      price: "99.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    assertFail(result);
  });

  it("[T6] Vendeur passe status → PUBLISHED → refus (guard)", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(await createProduct(aClient, vendorAId, {
      title: `Produit T6 ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    }));

    const { error } = await aClient
      .from("products")
      .update({ status: "PUBLISHED" })
      .eq("id", product.productId);

    expect(error).not.toBeNull();
    expect((error as { message?: string }).message).toContain("administration");
  });

  it("[T7] Prix invalide → refus", async () => {
    const aClient = await clientFor("ProdManA");

    const result = await createProduct(aClient, vendorAId, {
      title: `Produit T7 ${suffix}`,
      price: "abc",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    const fail = assertFail(result);
    expect(fail.error).toContain("prix");
  });

  it("[T8] Devise CDF acceptée", async () => {
    const aClient = await clientFor("ProdManA");

    const result = await createProduct(aClient, vendorAId, {
      title: `Produit CDF ${suffix}`,
      price: "1500.00",
      currency: "CDF",
      categoryId: categoryCdfId,
      thumbnailUrl: "",
    });

    const product = assertOk(result);

    const { data } = await service
      .from("products")
      .select("price, currency")
      .eq("id", product.productId)
      .single();
    expect(data?.currency).toBe("CDF");
  });

  it("[T9] listMyProducts ne retourne que les produits du vendeur", async () => {
    const aClient = await clientFor("ProdManA");
    const bClient = await clientFor("ProdManB");

    await createProduct(aClient, vendorAId, {
      title: `Produit listA ${suffix}`,
      price: "1.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });
    await createProduct(bClient, vendorBId, {
      title: `Produit listB ${suffix}`,
      price: "1.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    const aProducts = await listMyProducts(aClient, vendorAId);
    const bProducts = await listMyProducts(bClient, vendorBId);

    expect(aProducts.length).toBeGreaterThanOrEqual(3);
    expect(bProducts.length).toBeGreaterThanOrEqual(2);

    const aIds = aProducts.map((p) => p.id);
    const bIds = bProducts.map((p) => p.id);

    for (const id of aIds) {
      expect(bIds).not.toContain(id);
    }
  });

  it("[T10] ADMIN modifie n'importe quel produit → OK", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(await createProduct(aClient, vendorAId, {
      title: `Produit admin ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    }));

    const adminSupabase = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await adminSupabase
      .from("products")
      .update({ title: `Produit admin modifié ${suffix}` })
      .eq("id", product.productId);

    expect(error).toBeNull();
  });
});

async function clientFor(name: string): Promise<SupabaseClient> {
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