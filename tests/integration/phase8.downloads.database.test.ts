/**
 * PHASE 8 â€” Livraison numÃ©rique : RPC `create_download_grant` (0012).
 * Le droit est DÃ‰RIVÃ‰ : commande PAID + acheteur = auth.uid() ; vendeur de la
 * ligne ; admin. Chaque demande rÃ©ussie journalise dans `downloads`.
 *
 * Couverture :
 *  [T1] acheteur d'une commande PAID â†’ grant + ligne `downloads` ;
 *  [T2] utilisateur authentifiÃ© Ã©tranger â†’ refus, zÃ©ro journalisation ;
 *  [T3] commande PENDING â†’ refus ;
 *  [T4] commande REFUNDED aprÃ¨s PAID â†’ refus (rÃ©vocation post-remboursement) ;
 *  [T5] vendeur propriÃ©taire de la ligne (boutique ACTIVE) â†’ autorisÃ© ;
 *  [T6] anonyme â†’ exÃ©cution refusÃ©e (grant authenticated/service_role seul) ;
 *  [T7] produit sans `product_files` â†’ Â« fichier indisponible Â».
 *
 * Suite autonome : utilisateurs supprimÃ©s en fin d'exÃ©cution (cascade).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const RAW_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const RAW_ANON = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const RAW_SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"];

if (!RAW_URL || !RAW_ANON || !RAW_SERVICE) {
  throw new Error("Variables Supabase manquantes pour les tests d'intÃ©gration.");
}

const URL: string = RAW_URL;
const ANON: string = RAW_ANON;
const SERVICE: string = RAW_SERVICE;

const suffix = Date.now().toString(36);
const PASSWORD = "Passw0rd!Test";

let service: SupabaseClient;
const createdUsers: User[] = [];

let buyerId = "";
let strangerId = "";
let publishedProductId = "";

const STORAGE_PATH = `smoke/p8-${suffix}/fichier.pdf`;
const FILE_NAME = "livraison-p8.pdf";
const MIME_TYPE = "application/pdf";

async function makeUser(name: string): Promise<{ user: User; client: SupabaseClient }> {
  const email = `${name.toLowerCase()}.${suffix}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  expect(error).toBeNull();
  if (data.user === null) throw new Error("Utilisateur non crÃ©Ã©");
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

async function sessionFor(name: string): Promise<SupabaseClient> {
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

interface VendorFixture {
  vendorRowId: string;
  productId: string;
}

async function makeActiveVendorWithProduct(params: {
  userName: string;
  slugBase: string;
  price: string;
  withFile: boolean;
}): Promise<VendorFixture> {
  const { user } = await makeUser(params.userName);
  const slug = `${params.slugBase}-${suffix}`;
  const { data: vendor, error: insErr } = await service
    .from("vendors")
    .insert({ user_id: user.id, store_name: `Shop ${params.slugBase}`, slug })
    .select("id")
    .single();
  expect(insErr).toBeNull();
  const vendorRowId = vendor?.id ?? "";
  const { error: actErr } = await service
    .from("vendors")
    .update({ status: "ACTIVE" })
    .eq("id", vendorRowId);
  expect(actErr).toBeNull();

  const productSlug = `${params.slugBase}-produit-${suffix}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  const { data: product, error: prodErr } = await service
    .from("products")
    .insert({
      vendor_id: vendorRowId,
      title: `Produit ${params.slugBase}`,
      slug: productSlug,
      price: params.price,
      currency: "USD",
      status: "PUBLISHED",
    })
    .select("id")
    .single();
  expect(prodErr).toBeNull();
  const productId = product?.id ?? "";

  if (params.withFile) {
    const { error: fileErr } = await service.from("product_files").insert({
      product_id: productId,
      storage_path: STORAGE_PATH,
      file_name: FILE_NAME,
      file_size_bytes: 2048,
      mime_type: MIME_TYPE,
      version: 1,
    });
    expect(fileErr).toBeNull();
  }

  return { vendorRowId, productId };
}

/** Commande via la vraie RPC checkout (Phase 6), paiement simulÃ© optionnel (Phase 7). */
async function createOrder(productIds: string[], options: { pay?: boolean } = {}): Promise<string> {
  const buyer = await sessionFor(`DlBuyer${suffix}`);
  const { data, error } = await buyer.rpc("create_checkout_order", {
    p_product_ids: productIds,
  });
  if (error !== null) throw new Error(`checkout refusÃ© : ${error.message}`);
  const orderId = (data as { order_id: string }).order_id;

  if (options.pay === true) {
    const { data: payRows } = await service
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .limit(1);
    const paymentId = payRows?.[0]?.id;
    if (paymentId === undefined) throw new Error("Paiement introuvable");
    const { error: confirmErr } = await service.rpc("confirm_order_payment", {
      p_payment_id: paymentId,
    });
    if (confirmErr !== null) throw new Error(`confirmation refusÃ©e : ${confirmErr.message}`);
  }
  return orderId;
}

async function firstItemId(orderId: string): Promise<string> {
  const { data } = await service.from("order_items").select("id").eq("order_id", orderId).limit(1);
  const id = data?.[0]?.id;
  if (id === undefined) throw new Error("Ligne de commande introuvable");
  return id;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  buyerId = (await makeUser(`DlBuyer${suffix}`)).user.id;
  strangerId = (await makeUser(`DlStranger${suffix}`)).user.id;
  publishedProductId = (
    await makeActiveVendorWithProduct({
      userName: `DlVendor${suffix}`,
      slugBase: "dlvendor",
      price: "12.00",
      withFile: true,
    })
  ).productId;
});

afterAll(async () => {
  for (const user of createdUsers) {
    await service.auth.admin.deleteUser(user.id);
  }
});

describe("Phase 8 â€” Livraison numÃ©rique (create_download_grant)", () => {
  it("[T1] acheteur d'une commande PAID â†’ grant + journalisation downloads", async () => {
    const orderId = await createOrder([publishedProductId], { pay: true });
    const itemId = await firstItemId(orderId);

    const client = await sessionFor(`DlBuyer${suffix}`);
    const { data, error } = await client.rpc("create_download_grant", {
      p_order_item: itemId,
    });
    expect(error).toBeNull();
    const grant = data as { storage_path: string; file_name: string; mime_type: string };
    expect(grant.storage_path).toBe(STORAGE_PATH);
    expect(grant.file_name).toBe(FILE_NAME);
    expect(grant.mime_type).toBe(MIME_TYPE);

    // Journal : au moins une ligne pour cet item et cet utilisateur.
    const { count } = await service
      .from("downloads")
      .select("id", { count: "exact", head: true })
      .eq("order_item_id", itemId)
      .eq("user_id", buyerId);
    expect(count ?? 0).toBeGreaterThanOrEqual(1);
  });

  it("[T2] utilisateur authentifiÃ© Ã©tranger â†’ refus, zÃ©ro journalisation", async () => {
    const orderId = await createOrder([publishedProductId], { pay: true });
    const itemId = await firstItemId(orderId);

    const stranger = await sessionFor(`DlStranger${suffix}`);
    const { data, error } = await stranger.rpc("create_download_grant", {
      p_order_item: itemId,
    });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Refus attendu pour un Ã©tranger");
    expect(/non autoris/i.test(error.message)).toBe(true);

    const { count } = await service
      .from("downloads")
      .select("id", { count: "exact", head: true })
      .eq("order_item_id", itemId)
      .eq("user_id", strangerId);
    expect(count ?? 0).toBe(0);
  });

  it("[T3] commande PENDING â†’ refus", async () => {
    const orderId = await createOrder([publishedProductId]); // non payÃ©e
    const itemId = await firstItemId(orderId);

    const client = await sessionFor(`DlBuyer${suffix}`);
    const { data, error } = await client.rpc("create_download_grant", {
      p_order_item: itemId,
    });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Refus attendu pour une commande non payÃ©e");
    expect(/non autoris/i.test(error.message)).toBe(true);
  });

  it("[T4] REFUNDED aprÃ¨s PAID â†’ rÃ©vocation effective", async () => {
    const orderId = await createOrder([publishedProductId], { pay: true });
    const itemId = await firstItemId(orderId);

    const client = await sessionFor(`DlBuyer${suffix}`);
    const ok = await client.rpc("create_download_grant", { p_order_item: itemId });
    expect(ok.error).toBeNull(); // PAID : autorisÃ©

    await service.from("orders").update({ status: "REFUNDED" }).eq("id", orderId);

    const revoked = await client.rpc("create_download_grant", { p_order_item: itemId });
    expect(revoked.data ?? null).toBeNull();
    if (revoked.error === null) throw new Error("Refus attendu aprÃ¨s remboursement");
    expect(/non autoris/i.test(revoked.error.message)).toBe(true);
  });

  it("[T5] vendeur propriÃ©taire de la ligne â†’ autorisÃ© mÃªme sur PENDING", async () => {
    const orderId = await createOrder([publishedProductId]);
    const itemId = await firstItemId(orderId);

    const vendorClient = await sessionFor(`DlVendor${suffix}`);
    const { data, error } = await vendorClient.rpc("create_download_grant", {
      p_order_item: itemId,
    });
    expect(error).toBeNull();
    const grant = data as { storage_path: string };
    expect(grant.storage_path).toBe(STORAGE_PATH);
  });

  it("[T6] anonyme â†’ exÃ©cution refusÃ©e", async () => {
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { data, error } = await anon.rpc("create_download_grant", {
      p_order_item: "00000000-0000-0000-0000-000000000000",
    });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Refus anonyme attendu");
    expect(/permission denied|connexion/i.test(error.message)).toBe(true);
  });

  it("[T7] produit sans product_files â†’ Â« fichier indisponible Â»", async () => {
    const bare = await makeActiveVendorWithProduct({
      userName: `DlVendorBare${suffix}`,
      slugBase: "dlbare",
      price: "8.00",
      withFile: false,
    });

    const orderId = await createOrder([bare.productId], { pay: true });
    const itemId = await firstItemId(orderId);

    const client = await sessionFor(`DlBuyer${suffix}`);
    const { data, error } = await client.rpc("create_download_grant", {
      p_order_item: itemId,
    });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Refus attendu sans fichier (message live : introuvable)");
    expect(/introuvable/i.test(error.message)).toBe(true);
  });
});
