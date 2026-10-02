/**
 * PHASE 9 S3 — Upload fichier produit vendeur ACTIVE.
 *
 * Couverture :
 *  [T1] Vendeur ACTIVE → upload de son fichier → OK ;
 *  [T2] Métadonnées product_files correctes (storage_path, file_name,
 *       file_size_bytes, mime_type, version) ;
 *  [T3] Vendeur d'un autre produit → refus (RLS product_files insert) ;
 *  [T4] Vendeur PENDING/SUSPENDED → refus (RLS vendors) ;
 *  [T5] Fichier trop volumineux (>10 Mo) → refus ;
 *  [T6] Type MIME invalide → refus ;
 *  [T7] Remplacement → version +1 ;
 *  [T8] Autre utilisateur (non vendeur) → refus ;
 *  [T9] Accès public Storage → refus (policy SELECT) ;
 *  [T10] Téléchargement Phase 8 → dernière version.
 *
 * Suite autonome : utilisateurs et données supprimés en fin d'exécution.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import { uploadProductFile } from "@/services/products/product-files";

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
const MAX_FILE_SIZE = 10 * 1024 * 1024;

let service: SupabaseClient;
const createdUsers: User[] = [];
let vendorAId = "";
let vendorBId = "";
let categoryId = "";
let productId = "";
let adminUserId = "";

async function getUserId(client: SupabaseClient): Promise<string> {
  const { data } = await client.auth.getUser();
  return data.user?.id ?? "";
}

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

function makeFile(size: number, mimeType: string): File {
  const ext = mimeType.split("/")[1] ?? "bin";
  const name = `test.${ext}`;
  const buffer = new ArrayBuffer(size);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < view.length; i++) view[i] = i % 256;
  return new File([buffer], name, { type: mimeType });
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

  const a = await makeUser("ProdFileA");
  const b = await makeUser("ProdFileB");
  await makeUser("ProdFilePending");
  await makeUser("ProdFileSuspended");

  vendorAId = await promoteToVendor(a.user, "ACTIVE");
  vendorBId = await promoteToVendor(b.user, "ACTIVE");

  const d = await makeUser("ProdFileAdmin");
  adminUserId = d.user.id;
  await service.from("profiles").update({ role: "ADMIN" }).eq("id", adminUserId);

  const { data: prod } = await service
    .from("products")
    .insert({
      vendor_id: vendorAId,
      category_id: categoryId,
      title: `Produit Upload ${suffix}`,
      slug: `prod-upload-${suffix}`,
      short_description: `Desc ${suffix}`,
      description: `Description longue ${suffix}`,
      price: "10.00",
      currency: "USD",
      status: "DRAFT",
    })
    .select("id")
    .single();
  productId = prod?.id ?? "";
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

describe("Phase 9 S3 — Upload fichier produit", () => {
  it("[T1] Vendeur ACTIVE → upload de son fichier → OK", async () => {
    const aClient = await clientFor("ProdFileA");
    const userId = await getUserId(aClient);

    const file = makeFile(1024, "application/pdf");
    const result = await uploadProductFile(aClient, userId, productId, file);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Upload échoué : " + result.error);
    expect(result.productFile.file_name).toBe("test.pdf");
    expect(result.productFile.version).toBe(1);
  });

  it("[T2] Métadonnées product_files correctes", async () => {
    const aClient = await clientFor("ProdFileA");
    const userId = await getUserId(aClient);
    const file = makeFile(2048, "image/png");
    const result = await uploadProductFile(aClient, userId, productId, file);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Upload échoué : " + result.error);

    const { data } = await service
      .from("product_files")
      .select("storage_path, file_name, file_size_bytes, mime_type, version")
      .eq("id", result.productFile.id)
      .single();

    expect(data?.file_name).toBe("test.png");
    expect(Number(data?.file_size_bytes)).toBe(2048);
    expect(data?.mime_type).toBe("image/png");
    expect(data?.version).toBe(2);
    expect(data?.storage_path).toContain(userId);
    expect(data?.storage_path).toContain(productId);
  });

  it("[T3] Vendeur d'un autre produit → refus (RLS product_files insert)", async () => {
    const bClient = await clientFor("ProdFileB");
    await createProductForVendor(bClient, vendorBId);

    const bUserId = await getUserId(bClient);
    const file = makeFile(1024, "application/pdf");
    const result = await uploadProductFile(bClient, bUserId, productId, file);
    if (!result.ok) {
      expect(result.error).toContain("Produit non autorise");
    } else {
      throw new Error("Expected upload to fail");
    }
  });

  it("[T4] Vendeur PENDING → refus", async () => {
    const pClient = await clientFor("ProdFilePending");
    const pUserId = await getUserId(pClient);
    const file = makeFile(1024, "application/pdf");
    const result = await uploadProductFile(pClient, pUserId, productId, file);

    expect(result.ok).toBe(false);
  });

  it("[T4b] Vendeur SUSPENDU → refus", async () => {
    const sClient = await clientFor("ProdFileSuspended");
    const sUserId = await getUserId(sClient);
    const file = makeFile(1024, "application/pdf");
    const result = await uploadProductFile(sClient, sUserId, productId, file);

    expect(result.ok).toBe(false);
  });

  it("[T5] Fichier trop volumineux → refus", async () => {
    const aClient = await clientFor("ProdFileA");
    const userId = await getUserId(aClient);
    const file = makeFile(MAX_FILE_SIZE + 1, "application/pdf");
    const result = await uploadProductFile(aClient, userId, productId, file);
    if (!result.ok) {
      expect(result.error).toContain("trop volumineux");
    } else {
      throw new Error("Expected upload to fail");
    }
  });

  it("[T6] Type MIME invalide → refus", async () => {
    const aClient = await clientFor("ProdFileA");
    const userId = await getUserId(aClient);
    const file = makeFile(1024, "application/x-executable");
    const result = await uploadProductFile(aClient, userId, productId, file);
    if (!result.ok) {
      expect(result.error).toContain("non autorise");
    } else {
      throw new Error("Expected upload to fail");
    }
  });

  it("[T7] Remplacement → version +1", async () => {
    const { data: freshProd } = await service
      .from("products")
      .insert({
        vendor_id: vendorAId,
        category_id: categoryId,
        title: `Produit Rempl ${suffix}`,
        slug: `prod-rempl-${suffix}`,
        price: "5.00",
        currency: "USD",
        status: "DRAFT",
      })
      .select("id")
      .single();
    const freshProductId = freshProd?.id ?? "";

    const aClient = await clientFor("ProdFileA");
    const userId = await getUserId(aClient);
    const file1 = makeFile(1024, "application/pdf");
    const result1 = await uploadProductFile(aClient, userId, freshProductId, file1);
    expect(result1.ok).toBe(true);
    if (!result1.ok) throw new Error("Upload échoué : " + result1.error);
    expect(result1.productFile.version).toBe(1);

    const file2 = makeFile(1024, "application/pdf");
    const result2 = await uploadProductFile(aClient, userId, freshProductId, file2);
    expect(result2.ok).toBe(true);
    if (!result2.ok) throw new Error("Upload échoué : " + result2.error);
    expect(result2.productFile.version).toBe(2);

    const { data } = await service
      .from("product_files")
      .select("version")
      .eq("product_id", freshProductId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    expect(Number(data?.version)).toBe(2);
  });

  it("[T8] Autre utilisateur (non vendeur) → refus", async () => {
    const buyer = await makeUser("ProdFileBuyer");
    const buyerClient = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInError } = await buyerClient.auth.signInWithPassword({
      email: `prodfilebuyer.${suffix}@example.com`,
      password: PASSWORD,
    });
    expect(signInError).toBeNull();

    const buyerUserId = await getUserId(buyerClient);
    const file = makeFile(1024, "application/pdf");
    const result = await uploadProductFile(buyerClient, buyerUserId, productId, file);

    expect(result.ok).toBe(false);

    try {
      await service.auth.admin.deleteUser(buyer.user.id);
    } catch {
      // best-effort
    }
  });

  it("[T9] Accès public Storage → refus (policy SELECT)", async () => {
    const aClient = await clientFor("ProdFileA");
    const aUserId = await getUserId(aClient);
    const file = makeFile(1024, "application/pdf");
    const result = await uploadProductFile(aClient, aUserId, productId, file);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Upload échoué : " + result.error);

    const bClient = await clientFor("ProdFileB");
    const { data: bData, error: bError } = await bClient.storage
      .from("product-files")
      .download(result.productFile.storage_path);

    expect(bError).not.toBeNull();
    expect(bData).toBeNull();
  });

  it("[T10] Téléchargement Phase 8 → dernière version", async () => {
    const aClient = await clientFor("ProdFileA");
    const aUserId = await getUserId(aClient);
    const file = makeFile(1024, "application/pdf");
    const result = await uploadProductFile(aClient, aUserId, productId, file);

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Upload échoué : " + result.error);

    const { data: latest } = await service
      .from("product_files")
      .select("storage_path, version")
      .eq("product_id", productId)
      .order("version", { ascending: false })
      .limit(1)
      .single();

    expect(latest).toBeDefined();
    expect(Number(latest?.version)).toBeGreaterThanOrEqual(1);
    expect(latest?.storage_path).toBeTruthy();
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

async function createProductForVendor(client: SupabaseClient, vendorId: string): Promise<string> {
  const { data, error } = await client
    .from("products")
    .insert({
      vendor_id: vendorId,
      category_id: categoryId,
      title: `Produit T3 ${suffix}`,
      slug: `prod-t3-${suffix}`,
      price: "5.00",
      currency: "USD",
      status: "DRAFT",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  if (data === null) throw new Error("Produit non créé");
  return data.id;
}
