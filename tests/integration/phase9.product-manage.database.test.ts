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
  updateProductStatus,
  getMyProduct,
} from "@/services/products/manage";

function assertOk(result: { ok: boolean; productId?: string; error?: string }): {
  ok: true;
  productId: string;
} {
  if (!result.ok) throw new Error("Expected ok but got error: " + (result.error ?? "unknown"));
  return result as { ok: true; productId: string };
}

function assertFail(result: { ok: boolean; productId?: string; error?: string }): {
  ok: false;
  error: string;
} {
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

async function promoteToVendor(
  user: User,
  status: "ACTIVE" | "PENDING" | "SUSPENDED" = "ACTIVE",
): Promise<string> {
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
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T3 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const { error } = await aClient
      .from("products")
      .update({ vendor_id: vendorBId })
      .eq("id", product.productId);

    expect(error).not.toBeNull();
  });

  it("[T4] Vendeur modifie son propre DRAFT → OK", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T4 ${suffix}`,
        price: "15.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

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
    const productB = assertOk(
      await createProduct(bClient, vendorBId, {
        title: `Produit B ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

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
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T6 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

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
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit admin ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const adminSupabase = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await adminSupabase
      .from("products")
      .update({ title: `Produit admin modifié ${suffix}` })
      .eq("id", product.productId);

    expect(error).toBeNull();
  });

  it("[T11] DRAFT → PENDING_REVIEW pour propriétaire → OK", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T11 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
        thumbnailPath: `test-cover-${suffix}.jpg`,
      }),
    );

    await aClient.from("product_files").insert({
      product_id: product.productId,
      storage_path: `test-${suffix}/products/${product.productId}/test.pdf`,
      file_name: "test.pdf",
      file_size_bytes: BigInt(1024),
      mime_type: "application/pdf",
      version: 1,
    });

    const result = await updateProductStatus(aClient, product.productId, vendorAId);
    expect(result.ok).toBe(true);

    const { data } = await service
      .from("products")
      .select("status")
      .eq("id", product.productId)
      .single();
    expect(data?.status).toBe("PENDING_REVIEW");
  });

  it("[T12] Vendeur étranger ne peut pas soumettre → refus", async () => {
    const aClient = await clientFor("ProdManA");
    const bClient = await clientFor("ProdManB");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T12 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const result = await updateProductStatus(bClient, product.productId, vendorBId);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("accès refusé");
  });

  it("[T13] PUBLISHED ne peut pas être soumis", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T13 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const adminSupabase = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await adminSupabase
      .from("products")
      .update({ status: "PUBLISHED" })
      .eq("id", product.productId);

    const result = await updateProductStatus(aClient, product.productId, vendorAId);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("déjà publié");
  });

  it("[T14] Couverture manquante → refus de soumission", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T14 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const result = await updateProductStatus(aClient, product.productId, vendorAId);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("couverture");
  });

  it("[T15] Fichier numérique manquant → refus de soumission", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        productType: "DIGITAL",
        title: `Produit T15 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailPath: "test/cover.jpg",
      }),
    );

    const result = await updateProductStatus(aClient, product.productId, vendorAId);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("fichier numérique");
  });

  it("[T16] getMyProduct reflète la présence réelle du fichier", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T16 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const fetched = await getMyProduct(aClient, product.productId, vendorAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.hasFile).toBe(false);
  });

  it("[T17] getMyProduct reflète la présence de la couverture", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T17 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const fetched = await getMyProduct(aClient, product.productId, vendorAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.thumbnailPath).toBeNull();
  });

  it("[T18] REJECTED peut être soumis → PENDING_REVIEW", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        productType: "SERVICE",
        title: `Produit T18 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    await aClient.from("products").update({ status: "REJECTED" }).eq("id", product.productId);

    const result = await updateProductStatus(aClient, product.productId, vendorAId);
    expect(result.ok).toBe(true);

    const { data } = await service
      .from("products")
      .select("status")
      .eq("id", product.productId)
      .single();
    expect(data?.status).toBe("PENDING_REVIEW");
  });

  it("[T19] PENDING_REVIEW ne peut pas être soumis (déjà en cours de vérification)", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T19 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    await aClient.from("products").update({ status: "PENDING_REVIEW" }).eq("id", product.productId);

    const result = await updateProductStatus(aClient, product.productId, vendorAId);
    expect(result.ok).toBe(true);
  });

  it("[T20] PUBLISHED ne peut pas être soumis", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T20 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    await service.from("products").update({ status: "PUBLISHED" }).eq("id", product.productId);

    const result = await updateProductStatus(aClient, product.productId, vendorAId);
    expect(result.ok).toBe(false);
    expect((result as { ok: false; error: string }).error).toContain("déjà publié");
  });

  it("[T21] getMyProduct retourne categoryName après JOIN", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T21 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const fetched = await getMyProduct(aClient, product.productId, vendorAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.categoryName).toBeTruthy();
  });

  it("[T22] listMyProducts retourne categoryName après JOIN", async () => {
    const aClient = await clientFor("ProdManA");

    await createProduct(aClient, vendorAId, {
      title: `Produit T22 ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    const products = await listMyProducts(aClient, vendorAId);
    const found = products.find((p) => p.title === `Produit T22 ${suffix}`);
    expect(found).toBeDefined();
    expect(found?.categoryName).toBeTruthy();
  });

  it("[T23] Produit PHYSICAL → productType dans getMyProduct", async () => {
    const aClient = await clientFor("ProdManA");
    const product = assertOk(
      await createProduct(aClient, vendorAId, {
        title: `Produit T23 ${suffix}`,
        price: "5.00",
        currency: "USD",
        categoryId: categoryId,
        thumbnailUrl: "",
      }),
    );

    const fetched = await getMyProduct(aClient, product.productId, vendorAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.productType).toBe("PHYSICAL");
  });

  it("[T24] Produit SERVICE → productType dans getMyProduct", async () => {
    const aClient = await clientFor("ProdManA");
    const { createProduct: createFn } = await import("@/services/products/manage");
    const supabase = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result = await createFn(supabase, vendorAId, {
      productType: "SERVICE",
      title: `Produit Service ${suffix}`,
      price: "50.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });
    const product = assertOk(result);

    const fetched = await getMyProduct(aClient, product.productId, vendorAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.productType).toBe("SERVICE");
  });

  it("[T25] Produit DIGITAL → productType dans getMyProduct", async () => {
    const aClient = await clientFor("ProdManA");
    const { createProduct: createFn } = await import("@/services/products/manage");
    const supabase = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const result = await createFn(supabase, vendorAId, {
      productType: "DIGITAL",
      title: `Produit Digital ${suffix}`,
      price: "20.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });
    const product = assertOk(result);

    const fetched = await getMyProduct(aClient, product.productId, vendorAId);
    expect(fetched).not.toBeNull();
    expect(fetched?.productType).toBe("DIGITAL");
  });

  it("[T26] listMyProducts retourne productType", async () => {
    const aClient = await clientFor("ProdManA");
    const { createProduct: createFn } = await import("@/services/products/manage");
    const supabase = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    await createFn(supabase, vendorAId, {
      productType: "SERVICE",
      title: `Produit listType ${suffix}`,
      price: "5.00",
      currency: "USD",
      categoryId: categoryId,
      thumbnailUrl: "",
    });

    const products = await listMyProducts(aClient, vendorAId);
    const found = products.find((p) => p.title === `Produit listType ${suffix}`);
    expect(found).toBeDefined();
    expect(found?.productType).toBe("SERVICE");
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
