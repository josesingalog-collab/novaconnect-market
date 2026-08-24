/**
 * TESTS D'INTÉGRATION PHASE 4 — lectures publiques du catalogue (RLS).
 *
 * Scénarios :
 *  1. produit PUBLISHED d'un vendeur ACTIVE visible par anon via le service ;
 *  2. DRAFT / PENDING_REVIEW / ARCHIVED invisibles ;
 *  3. produit PUBLISHED d'un vendeur SUSPENDED invisible ;
 *  4. seules les catégories is_active sont publiques ;
 *  5. vendeur PENDING absent des vitrines (et SUSPENDED aussi) ;
 *  6. recherche .ilike(title) opérationnelle (jokers neutralisés) ;
 *  7. pagination .range() plafonnée à 24 par page, total exact ;
 *  8. product_files interdit à anon même sur un produit publié.
 *
 * Suite autonome : utilisateurs et données supprimés en fin d'exécution.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  getPublicProductBySlug,
  getPublicVendorBySlug,
  listPublicCategories,
  listPublicProducts,
  MAX_PAGE_SIZE,
} from "@/services/products/public";

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
let anon: SupabaseClient;
let vendorAId = "";
let vendorBId = "";
let categoryActiveId = "";

async function makeVendorUser(fullName: string): Promise<{ user: User; client: SupabaseClient }> {
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
  anon = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Catégories : une active, une inactive (écriture service_role uniquement).
  const slugA = `formations-${suffix}`;
  const { data: catActive, error: catErr } = await service
    .from("categories")
    .insert({ name: `Formations ${suffix}`, slug: slugA, is_active: true })
    .select("id")
    .single();
  expect(catErr).toBeNull();
  if (catActive !== null) categoryActiveId = catActive.id;

  const { error: catInactiveErr } = await service.from("categories").insert({
    name: `Archivée ${suffix}`,
    slug: `archivee-${suffix}`,
    is_active: false,
  });
  expect(catInactiveErr).toBeNull();

  // Trois vendeurs : A actif, B suspendu, C en attente (défaut).
  const a = await makeVendorUser(`VendeurA${suffix}`);
  const b = await makeVendorUser(`VendeurB${suffix}`);
  const c = await makeVendorUser(`VendeurC${suffix}`);

  for (const [vendorUserId, storeName, slug] of [
    [a.user.id, `Boutique A ${suffix}`, `boutique-a-${suffix}`],
    [b.user.id, `Boutique B ${suffix}`, `boutique-b-${suffix}`],
    [c.user.id, `Boutique C ${suffix}`, `boutique-c-${suffix}`],
  ] as const) {
    const { data, error } = await service
      .from("vendors")
      .insert({ user_id: vendorUserId, store_name: storeName, slug })
      .select("id")
      .single();
    expect(error).toBeNull();
    if (slug.startsWith("boutique-a")) vendorAId = data?.id ?? "";
    if (slug.startsWith("boutique-b")) vendorBId = data?.id ?? "";
  }

  await service.from("vendors").update({ status: "ACTIVE" }).eq("id", vendorAId);
  await service.from("vendors").update({ status: "SUSPENDED" }).eq("id", vendorBId);
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

describe("Phase 4 — Catalogue public (RLS)", () => {
  it("rend visible le produit PUBLISHED d'un vendeur ACTIVE", async () => {
    const { data: inserted, error } = await service
      .from("products")
      .insert({
        vendor_id: vendorAId,
        category_id: categoryActiveId,
        title: "Ebook Marketing Digital",
        slug: `ebook-marketing-${suffix}`,
        short_description: "Guide complet",
        price: "15.00",
        currency: "USD",
        status: "DRAFT",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    await service.from("products").update({ status: "PUBLISHED" }).eq("id", inserted?.id ?? "");

    const page = await listPublicProducts(anon);
    const slugs = page.products.map((p) => p.slug);

    expect(slugs).toContain(`ebook-marketing-${suffix}`);
    expect(page.total).toBeGreaterThanOrEqual(1);

    const fiche = await getPublicProductBySlug(anon, `ebook-marketing-${suffix}`);
    expect(fiche).not.toBeNull();
    expect(fiche?.storeSlug).toBe(`boutique-a-${suffix}`);
    expect(fiche?.categoryName).toBe(`Formations ${suffix}`);
    expect(fiche?.price).toBe("15");
  });

  it("cache DRAFT, PENDING_REVIEW et ARCHIVED au public", async () => {
    const base = {
      vendor_id: vendorAId,
      price: "10.00",
      currency: "USD",
      category_id: categoryActiveId,
    };
    const { data: rows, error } = await service
      .from("products")
      .insert([
        { ...base, title: "Brouillon secret", slug: `brouillon-${suffix}`, status: "DRAFT" },
        { ...base, title: "En revue", slug: `en-revue-${suffix}`, status: "PENDING_REVIEW" },
      ])
      .select("id");
    expect(error).toBeNull();
    const draftId = rows?.[0]?.id ?? "";

    await service.from("products").update({ status: "ARCHIVED" }).eq("id", draftId);

    const page = await listPublicProducts(anon);
    const slugs = page.products.map((p) => p.slug);

    expect(slugs).not.toContain(`brouillon-${suffix}`);
    expect(slugs).not.toContain(`en-revue-${suffix}`);

    expect(await getPublicProductBySlug(anon, `brouillon-${suffix}`)).toBeNull();
    expect(await getPublicProductBySlug(anon, `en-revue-${suffix}`)).toBeNull();
  });

  it("cache le produit PUBLISHED d'un vendeur SUSPENDED", async () => {
    const { data: inserted, error } = await service
      .from("products")
      .insert({
        vendor_id: vendorBId,
        title: "Produit boutique suspendue",
        slug: `produit-suspendu-${suffix}`,
        price: "5.00",
        currency: "USD",
        status: "DRAFT",
      })
      .select("id")
      .single();
    expect(error).toBeNull();

    await service.from("products").update({ status: "PUBLISHED" }).eq("id", inserted?.id ?? "");

    const page = await listPublicProducts(anon);
    expect(page.products.map((p) => p.slug)).not.toContain(`produit-suspendu-${suffix}`);
    expect(await getPublicProductBySlug(anon, `produit-suspendu-${suffix}`)).toBeNull();
  });

  it("n'expose que les catégories actives via le service public", async () => {
    const categories = await listPublicCategories(anon);
    const names = categories.map((c) => c.name);

    expect(names).toContain(`Formations ${suffix}`);
    expect(names).not.toContain(`Archivée ${suffix}`);
  });

  it("masque les vendeurs PENDING et SUSPENDED des vitrines", async () => {
    expect(await getPublicVendorBySlug(anon, `boutique-a-${suffix}`)).not.toBeNull();
    expect(await getPublicVendorBySlug(anon, `boutique-b-${suffix}`)).toBeNull();
    expect(await getPublicVendorBySlug(anon, `boutique-c-${suffix}`)).toBeNull();
  });

  it("recherche par titre avec .ilike et neutralise les jokers", async () => {
    const result = await listPublicProducts(anon, { search: "MARKETING" });

    expect(result.products.map((p) => p.title)).toContain("Ebook Marketing Digital");

    const none = await listPublicProducts(anon, { search: "%ebook%" });
    // Le % saisi est littéral : aucun joker injecté → rien ne matche.
    expect(none.total).toBe(0);
  });

  it("plafonne la pagination à 24 éléments avec total exact", async () => {
    // 30 produits publiés chez le vendeur A (isolé du reste du catalogue).
    const batch = Array.from({ length: 30 }, (_, i) => ({
      vendor_id: vendorAId,
      title: `Pack ${String(i).padStart(2, "0")}`,
      slug: `pack-${String(i).padStart(2, "0")}-${suffix}`,
      price: `${i + 1}.00`,
      currency: "USD",
      status: "PUBLISHED",
    }));
    const { error } = await service.from("products").insert(batch);
    expect(error).toBeNull();

    // Périmètre strictement le vendeur A : ebook (15 $) + 30 packs = 31.
    const scope = { vendorId: vendorAId };
    const firstPage = await listPublicProducts(anon, { ...scope, sort: "price_asc" });
    expect(MAX_PAGE_SIZE).toBe(24);
    expect(firstPage.pageSize).toBe(24);
    expect(firstPage.products).toHaveLength(24);
    expect(firstPage.page).toBe(1);
    expect(firstPage.total).toBe(31);

    const secondPage = await listPublicProducts(anon, {
      ...scope,
      sort: "price_asc",
      page: 2,
    });
    expect(secondPage.total).toBe(31);
    expect(secondPage.products).toHaveLength(7);
    expect(firstPage.products[0]?.slug).not.toBe(secondPage.products[0]?.slug);

    const beyond = await listPublicProducts(anon, { ...scope, page: 999 });
    expect(beyond.products).toHaveLength(0);
    expect(beyond.total).toBe(31);
  });

  it("interdit product_files à anon même sur un produit publié", async () => {
    const { data: published } = await anon
      .from("products")
      .select("id")
      .eq("status", "PUBLISHED")
      .limit(1)
      .maybeSingle();
    expect(published).not.toBeNull();

    const { data: files, error } = await anon
      .from("product_files")
      .select("*")
      .eq("product_id", published?.id ?? "");

    expect(error).toBeNull();
    expect(files).toHaveLength(0);
  });
});
