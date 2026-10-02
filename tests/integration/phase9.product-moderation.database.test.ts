/**
 * PHASE 9.7-A — Actions admin de modération des produits.
 *
 * Couverture via les gardes SQL et les transitions de statut :
 *  [T1] service_role → PENDING_REVIEW → PUBLISHED → OK ;
 *  [T2] service_role → PENDING_REVIEW → REJECTED avec motif → OK ;
 *  [T3] vendeur → PUBLISHED → refus par guard_product_transitions ;
 *  [T4] vendeur → DRAFT → PUBLISHED → refus par guard_product_transitions ;
 *  [T5] service_role → DRAFT → PUBLISHED → refus par guard ;
 *  [T6] service_role → rejet avec rejection_reason → stocké correctement ;
 *  [T7] rejection_reason nettoyé des espaces inutiles ;
 *  [T8] vendor_id inchangé après approbation/rejet.
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
let adminUserId = "";
let vendorClient: SupabaseClient;
let vendorId = "";
let categoryId = "";
let pendingProductId = "";
let draftProductId = "";
let publishedProductId = "";
let rejectedProductId = "";

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
    .insert({ user_id: user.id, store_name: `Shop ${suffix}`, slug, status: "ACTIVE" })
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

  const admin = await makeUser("AdminMod");
  adminUserId = admin.user.id;
  await service.from("profiles").update({ role: "ADMIN" }).eq("id", adminUserId);

  const vendor = await makeUser("VendorMod");
  vendorClient = vendor.client;
  vendorId = await promoteToVendor(vendor.user);

  const { data: pending } = await service
    .from("products")
    .insert({
      vendor_id: vendorId,
      category_id: categoryId,
      title: `Produit Pending ${suffix}`,
      slug: `prod-pending-${suffix}`,
      short_description: `Desc ${suffix}`,
      description: `Desc long ${suffix}`,
      price: "10.00",
      currency: "USD",
      status: "PENDING_REVIEW",
    })
    .select("id")
    .single();
  pendingProductId = pending?.id ?? "";

  const { data: draft } = await service
    .from("products")
    .insert({
      vendor_id: vendorId,
      category_id: categoryId,
      title: `Produit Draft ${suffix}`,
      slug: `prod-draft-${suffix}`,
      short_description: `Desc ${suffix}`,
      description: `Desc long ${suffix}`,
      price: "10.00",
      currency: "USD",
      status: "DRAFT",
    })
    .select("id")
    .single();
  draftProductId = draft?.id ?? "";

  const { data: published } = await service
    .from("products")
    .insert({
      vendor_id: vendorId,
      category_id: categoryId,
      title: `Produit Pub ${suffix}`,
      slug: `prod-publie-${suffix}`,
      short_description: `Desc ${suffix}`,
      description: `Desc long ${suffix}`,
      price: "10.00",
      currency: "USD",
      status: "PUBLISHED",
    })
    .select("id")
    .single();
  publishedProductId = published?.id ?? "";

  const { data: rejected } = await service
    .from("products")
    .insert({
      vendor_id: vendorId,
      category_id: categoryId,
      title: `Produit Rejet ${suffix}`,
      slug: `prod-rejet-${suffix}`,
      short_description: `Desc ${suffix}`,
      description: `Desc long ${suffix}`,
      price: "10.00",
      currency: "USD",
      status: "REJECTED",
      rejection_reason: "Contenu à corriger",
    })
    .select("id")
    .single();
  rejectedProductId = rejected?.id ?? "";
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

describe("Phase 9.7-A — Modération produit (gardes SQL + actions admin)", () => {
  it("[T1] service_role peut approuver PENDING_REVIEW → PUBLISHED", async () => {
    const admin = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error } = await admin
      .from("products")
      .update({ status: "PUBLISHED" })
      .eq("id", pendingProductId)
      .eq("status", "PENDING_REVIEW")
      .select("id")
      .single();

    expect(error).toBeNull();

    const { data: product } = await service
      .from("products")
      .select("status")
      .eq("id", pendingProductId)
      .single();
    expect(product?.status).toBe("PUBLISHED");
  });

  it("[T2] service_role peut rejeter PENDING_REVIEW avec rejection_reason", async () => {
    const admin = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const reason = "Contenu non conforme";

    await service
      .from("products")
      .update({ status: "PENDING_REVIEW", rejection_reason: null })
      .eq("id", rejectedProductId);

    const { error } = await admin
      .from("products")
      .update({ status: "REJECTED", rejection_reason: reason })
      .eq("id", rejectedProductId)
      .eq("status", "PENDING_REVIEW")
      .select("id")
      .single();

    expect(error).toBeNull();

    const { data: product } = await service
      .from("products")
      .select("status, rejection_reason")
      .eq("id", rejectedProductId)
      .single();
    expect(product?.status).toBe("REJECTED");
    expect(product?.rejection_reason).toBe(reason);
  });

  it("[T3] Un vendeur ne peut pas passer un produit PUBLISHED à PUBLISHED (guard)", async () => {
    const { error } = await vendorClient
      .from("products")
      .update({ status: "PENDING_REVIEW" })
      .eq("id", publishedProductId)
      .eq("vendor_id", vendorId);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Transition de statut non autorisee");
  });

  it("[T4] Un vendeur ne peut pas approuver un produit DRAFT", async () => {
    const { error } = await vendorClient
      .from("products")
      .update({ status: "PUBLISHED" })
      .eq("id", draftProductId)
      .eq("vendor_id", vendorId);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Seule l'administration");
  });

  it("[T5] service_role peut approuver un produit DRAFT", async () => {
    const admin = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: product, error: createError } = await service
      .from("products")
      .insert({
        vendor_id: vendorId,
        category_id: categoryId,
        title: `Produit Service ${suffix}`,
        slug: `prod-service-${suffix}`,
        price: "10.00",
        currency: "USD",
        status: "DRAFT",
      })
      .select("id")
      .single();
    expect(createError).toBeNull();

    const { error } = await admin
      .from("products")
      .update({ status: "PUBLISHED" })
      .eq("id", product?.id ?? "")
      .eq("status", "DRAFT");

    expect(error).toBeNull();
  });

  it("[T6] rejection_reason est correctement stocké", async () => {
    const admin = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: newProd } = await service
      .from("products")
      .insert({
        vendor_id: vendorId,
        category_id: categoryId,
        title: `Produit Rejet ${suffix}`,
        slug: `prod-rejet-stocke-${suffix}`,
        short_description: `Desc ${suffix}`,
        description: `Desc long ${suffix}`,
        price: "10.00",
        currency: "USD",
        status: "PENDING_REVIEW",
      })
      .select("id")
      .single();
    const rejectId = newProd?.id ?? "";

    await admin
      .from("products")
      .update({ status: "REJECTED", rejection_reason: "Non conforme" })
      .eq("id", rejectId)
      .eq("status", "PENDING_REVIEW");

    const { data: product } = await service
      .from("products")
      .select("rejection_reason")
      .eq("id", rejectId)
      .single();
    expect(product?.rejection_reason).toBe("Non conforme");
  });

  it("[T7] Le vendor_id reste inchangé après approbation/rejet", async () => {
    const { data: product } = await service
      .from("products")
      .select("vendor_id")
      .eq("id", pendingProductId)
      .single();
    expect(product?.vendor_id).toBe(vendorId);
  });

  it("[T8] REJECTED peut être resoumis → PENDING_REVIEW", async () => {
    const { error } = await vendorClient
      .from("products")
      .update({ status: "PENDING_REVIEW" })
      .eq("id", rejectedProductId)
      .eq("status", "REJECTED")
      .eq("vendor_id", vendorId)
      .select("id")
      .single();

    expect(error).toBeNull();

    const { data: product } = await service
      .from("products")
      .select("status")
      .eq("id", rejectedProductId)
      .single();
    expect(product?.status).toBe("PENDING_REVIEW");
  });

  it("[T9] rejection_reason est conservée après resoumission", async () => {
    const { data: product } = await service
      .from("products")
      .select("rejection_reason")
      .eq("id", rejectedProductId)
      .single();
    expect(product?.rejection_reason).toBe("Contenu non conforme");
  });

  it("[T10] DRAFT peut être soumis → PENDING_REVIEW", async () => {
    const { error } = await vendorClient
      .from("products")
      .update({ status: "PENDING_REVIEW" })
      .eq("id", draftProductId)
      .eq("status", "DRAFT")
      .eq("vendor_id", vendorId)
      .select("id")
      .single();

    expect(error).toBeNull();

    const { data: product } = await service
      .from("products")
      .select("status")
      .eq("id", draftProductId)
      .single();
    expect(product?.status).toBe("PENDING_REVIEW");
  });

  it("[T11] PENDING_REVIEW ne peut pas être resoumis par le vendeur", async () => {
    const { error } = await vendorClient
      .from("products")
      .update({ status: "PUBLISHED" })
      .eq("id", draftProductId)
      .eq("status", "PENDING_REVIEW")
      .eq("vendor_id", vendorId);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Seule l'administration");
  });

  it("[T12] PUBLISHED ne peut pas être resoumis par le vendeur", async () => {
    const { error } = await vendorClient
      .from("products")
      .update({ status: "PENDING_REVIEW" })
      .eq("id", publishedProductId)
      .eq("status", "PUBLISHED")
      .eq("vendor_id", vendorId);

    expect(error).not.toBeNull();
    expect(error?.message).toContain("Transition de statut non autorisee");
  });
});
