/**
 * PHASE 6 — Checkout : RPC atomique `create_checkout_order`, snapshots,
 * re-pricing serveur, isolation RLS commandes.
 *
 * Couverture :
 *  [T1] appel anonyme → refus ;
 *  [T2] commande simple : PENDING, snapshot exact, dédoublonnage ids ;
 *  [T3] paiement PENDING provider 'mock' créé ;
 *  [T4] prix modifié en base → totaux serveur (jamais le panier) ;
 *  [T5] produit non publié → refus global, aucune commande créée ;
 *  [T6] multi-vendeurs même devise → N lignes, commissions par boutique ;
 *  [T7] devises mélangées → refus ;
 *  [T8] isolation RLS : acheteur/vendeur ne voient que leurs données ;
 *  [T9] écriture directe orders interdite (aucune policy) ;
 *  [T10] arrondi half-up identique TS ↔ PostgreSQL ;
 *  [T11] numéros de commande uniques.
 *
 * Suite autonome : utilisateurs supprimés en fin d'exécution (cascade).
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";
import {
  computeCommissionAmount,
  decimalStringToMinor,
  minorToDecimalString,
} from "../../lib/money";

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

let buyerAId = "";
let vendorUId = "";
let vendorWId = "";
let vendorCId = "";

let pUsd10 = "";
let pUsd999 = "";
let pUsdDraft = "";
let pMultiA = "";
let pMultiB = "";
let pCdf25000 = "";

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

interface VendorFixture {
  vendorRowId: string;
}

async function makeActiveVendor(
  userName: string,
  slugBase: string,
): Promise<VendorFixture> {
  const { user } = await makeUser(userName);
  const slug = `${slugBase}-${suffix}`;
  const { data: vendor, error: insErr } = await service
    .from("vendors")
    .insert({ user_id: user.id, store_name: `Shop ${slugBase}`, slug })
    .select("id")
    .single();
  expect(insErr).toBeNull();
  const { error: actErr } = await service
    .from("vendors")
    .update({ status: "ACTIVE" })
    .eq("id", vendor?.id ?? "");
  expect(actErr).toBeNull();
  return { vendorRowId: vendor?.id ?? "" };
}

async function makePublishedProduct(params: {
  vendorRowId: string;
  title: string;
  price: string;
  currency: "USD" | "CDF";
}): Promise<string> {
  const slug = params.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const { data, error } = await service
    .from("products")
    .insert({
      vendor_id: params.vendorRowId,
      title: params.title,
      slug: `${slug}-${Math.random().toString(36).slice(2, 8)}`,
      price: params.price,
      currency: params.currency,
      status: "PUBLISHED",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data?.id ?? "";
}

async function countOrders(buyerProfileId: string): Promise<number> {
  const { data } = await service
    .from("orders")
    .select("id", { count: "exact", head: false })
    .eq("buyer_id", buyerProfileId);
  return data?.length ?? 0;
}

/**
 * D-016 : PostgREST sérialise numeric en nombre JSON quand la valeur est
 * entière ("10" → 10). Canonise en decimal string à 2 décimales.
 */
function dec(value: string | number): string {
  return typeof value === "number" ? value.toFixed(2) : value;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const a = await makeUser(`OrderBuyerA${suffix}`);
  buyerAId = a.user.id;
  const b = await makeUser(`OrderBuyerB${suffix}`);

  const vu = await makeActiveVendor(`OrderVendorU${suffix}`, `vendoru-${suffix}`);
  vendorUId = vu.vendorRowId;
  const vw = await makeActiveVendor(`OrderVendorW${suffix}`, `vendorw-${suffix}`);
  vendorWId = vw.vendorRowId;
  const vc = await makeActiveVendor(`OrderVendorC${suffix}`, `vendorc-${suffix}`);
  vendorCId = vc.vendorRowId;

  pUsd10 = await makePublishedProduct({
    vendorRowId: vendorUId,
    title: "Ebook USD dix",
    price: "10.00",
    currency: "USD",
  });
  pUsd999 = await makePublishedProduct({
    vendorRowId: vendorUId,
    title: "Pack USD 9.99",
    price: "9.99",
    currency: "USD",
  });

  // Produit DRAFT du même vendeur : jamais commandable.
  const { data: draft, error: draftErr } = await service
    .from("products")
    .insert({
      vendor_id: vendorUId,
      title: "Produit brouillon",
      slug: `draft-${suffix}`,
      price: "99.00",
      currency: "USD",
      status: "DRAFT",
    })
    .select("id")
    .single();
  expect(draftErr).toBeNull();
  pUsdDraft = draft?.id ?? "";

  pMultiA = await makePublishedProduct({
    vendorRowId: vendorUId,
    title: "Multi vendeur U",
    price: "5.00",
    currency: "USD",
  });
  pMultiB = await makePublishedProduct({
    vendorRowId: vendorWId,
    title: "Multi vendeur W",
    price: "7.00",
    currency: "USD",
  });
  pCdf25000 = await makePublishedProduct({
    vendorRowId: vendorCId,
    title: "Formation CDF",
    price: "25000.00",
    currency: "CDF",
  });
}, 90_000);

afterAll(async () => {
  for (const id of [...createdUsers].reverse()) {
    try {
      await service.auth.admin.deleteUser(id.id);
    } catch {
      // best-effort cleanup
    }
  }
}, 60_000);

describe("Phase 6 — Checkout & commandes", () => {
  it("[T1] appel anonyme de la RPC → refus connexion requise", async () => {
    const anonymous = createClient(URL, ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anonymous.rpc("create_checkout_order", {
      p_product_ids: [pUsd10],
    });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Erreur anonyme attendue");
    // anon : soit refus d'exécution (revoke), soit refus interne sans session
    expect(/permission denied|connexion/i.test(error.message)).toBe(true);
  });

  it("[T2][T10] commande simple : snapshot exact + arrondi half-up TS↔SQL", async () => {
    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const { data, error } = await aClient
      .rpc("create_checkout_order", {
        p_product_ids: [pUsd10, pUsd999, pUsd999], // doublon volontaire
      })
      .returns<unknown>();
    expect(error).toBeNull();

    const order = data as {
      order_id: string;
      order_number: string;
      status: string;
      currency: string;
      subtotal: string;
      discount: string;
      platform_fee: string;
      total: string;
      items: Array<{
        product_id: string;
        unit_price: string;
        quantity: number;
        line_total: string;
        commission_rate_bps: number;
        commission_amount: string;
        vendor_amount: string;
        currency: string;
      }>;
    };

    expect(order.status).toBe("PENDING");
    expect(order.currency).toBe("USD");
    expect(order.order_number).toMatch(/^NC-\d{4}-\d{6}$/);
    expect(order.items).toHaveLength(2); // dédoublonné
    expect(order.discount).toBe("0.00");
    expect(order.subtotal).toBe("19.99");
    expect(order.total).toBe("19.99");

    const item999 = order.items.find((item) => item.product_id === pUsd999);
    expect(item999).toBeDefined();
    // Cross-check arrondi : SQL round(9.99*1000/10000, 2) vs lib/money half-up
    const tsMinor = computeCommissionAmount(
      decimalStringToMinor("9.99", "USD"),
      1000n,
    );
    expect(minorToDecimalString(tsMinor, "USD")).toBe(item999?.commission_amount);
    expect(item999?.commission_amount).toBe("1.00");

    // Snapshot cohérent côté table (contrainte chk_split)
    const { data: rows } = await service
      .from("order_items")
      .select("unit_price, quantity, line_total, commission_amount, vendor_amount, product_title")
      .eq("order_id", order.order_id);
    expect(rows).toHaveLength(2);
    for (const row of rows ?? []) {
      const split =
        Number(row.commission_amount) +
        Number(row.vendor_amount) -
        Number(row.line_total);
      expect(Math.abs(split)).toBeLessThan(1e-9);
      expect(row.quantity).toBe(1); // produits numériques
    }
  });

  it("[T3] paiement PENDING provider 'mock' créé avec la commande", async () => {
    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const { data } = await aClient.rpc("create_checkout_order", {
      p_product_ids: [pUsd10],
    });
    const order = data as { order_id: string; total: string };

    const { data: payment } = await service
      .from("payments")
      .select("provider, status, amount, currency, provider_reference")
      .eq("order_id", order.order_id)
      .single();
    expect(payment?.provider).toBe("mock");
    expect(payment?.status).toBe("PENDING");
    expect(dec(payment?.amount ?? "")).toBe(order.total);

    // La commande reste PENDING côté acheteur (aucun PAID sans webhook).
    const { data: ord } = await service
      .from("orders")
      .select("status, paid_at")
      .eq("id", order.order_id)
      .single();
    expect(ord?.status).toBe("PENDING");
    expect(ord?.paid_at).toBeNull();
  });

  it("[T4] prix modifié en base → le serveur fait foi, pas le panier", async () => {
    // Le « panier » du client affichait encore 10.00 ; on change le prix DB.
    const { error } = await service
      .from("products")
      .update({ price: "12.50" })
      .eq("id", pUsd10);
    expect(error).toBeNull();

    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const { data, error: rpcErr } = await aClient.rpc("create_checkout_order", {
      p_product_ids: [pUsd10],
    });
    expect(rpcErr).toBeNull();
    const order = data as { total: string; subtotal: string; platform_fee: string };
    expect(order.total).toBe("12.50");
    expect(order.subtotal).toBe("12.50");
    expect(order.platform_fee).toBe("1.25"); // 10 % recalculés sur le nouveau prix
  });

  it("[T5] produit non publié → refus global et zéro commande créée", async () => {
    const before = await countOrders(buyerAId);
    expect(before).toBeGreaterThan(0);

    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const { data, error } = await aClient.rpc("create_checkout_order", {
      p_product_ids: [pUsdDraft],
    });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Refus produit non publié attendu");
    expect(error.message.toLowerCase()).toContain("introuvable");

    const after = await countOrders(buyerAId);
    expect(after).toBe(before); // atomicité : rien créé
  });

  it("[T6] multi-vendeurs même devise → une commande, deux lignes, deux boutiques", async () => {
    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const { data, error } = await aClient.rpc("create_checkout_order", {
      p_product_ids: [pMultiA, pMultiB],
    });
    expect(error).toBeNull();
    const order = data as {
      order_id: string;
      subtotal: string;
      platform_fee: string;
      items: Array<{ vendor_id: string; commission_amount: string; line_total: string }>;
    };

    expect(order.subtotal).toBe("12.00");
    expect(order.platform_fee).toBe("1.20"); // 0.50 + 0.70
    expect(new Set(order.items.map((item) => item.vendor_id))).toEqual(
      new Set([vendorUId, vendorWId]),
    );

    // Lignes snapshotées liées aux bons vendeurs
    const { data: rows } = await service
      .from("order_items")
      .select("vendor_id, line_total")
      .eq("order_id", order.order_id);
    const byVendor = new Map(
      (rows ?? []).map((row) => [row.vendor_id, dec(row.line_total as string | number)]),
    );
    expect(byVendor.get(vendorUId)).toBe("5.00");
    expect(byVendor.get(vendorWId)).toBe("7.00");
  });

  it("[T7] devises mélangées → refus explicite", async () => {
    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const { data, error } = await aClient.rpc("create_checkout_order", {
      p_product_ids: [pUsd999, pCdf25000],
    });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Refus de devise attendu");
    expect(error.message.toLowerCase()).toContain("devise");
  });

  it("[T8] isolation RLS : chacun ne voit que ses commandes / ses lignes", async () => {
    // B passe SA commande.
    const bClient = await clientFor(`OrderBuyerB${suffix}`);
    const { data, error } = await bClient.rpc("create_checkout_order", {
      p_product_ids: [pUsd999],
    });
    expect(error).toBeNull();
    const bOrder = data as { order_id: string };

    // A ne voit PAS la commande de B.
    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const { data: seenByA } = await aClient
      .from("orders")
      .select("id")
      .eq("id", bOrder.order_id);
    expect(seenByA).toHaveLength(0);

    // B voit la sienne.
    const { data: seenByB } = await bClient
      .from("orders")
      .select("id")
      .eq("id", bOrder.order_id);
    expect(seenByB).toHaveLength(1);

    // Le vendeur U voit SES lignes (dont celle de B) mais pas celles d'autrui.
    const uClient = await clientFor(`OrderVendorU${suffix}`);
    const { data: vendorLines } = await uClient
      .from("order_items")
      .select("id, vendor_id")
      .limit(200);
    for (const line of vendorLines ?? []) {
      expect(line.vendor_id).toBe(vendorUId);
    }
    expect((vendorLines ?? []).length).toBeGreaterThan(0);
  });

  it("[T9] écriture directe orders : aucune modification possible par un client", async () => {
    const aClient = await clientFor(`OrderBuyerA${suffix}`);

    // Commande de référence.
    const { data: created, error: rpcErr } = await aClient.rpc("create_checkout_order", {
      p_product_ids: [pMultiA],
    });
    if (rpcErr !== null) throw new Error("Commande de référence attendue");
    const reference = created as { order_id: string; total: string };

    // Tentatives d'écriture directes : peu importe la forme du refus
    // (erreur PostgREST ou ligne filtrée), l'important est l'ABSENCE D'EFFET.
    await aClient.from("orders").insert({
      buyer_id: buyerAId,
      total: "1.00",
      currency: "USD",
      status: "PAID",
    });
    await aClient
      .from("orders")
      .update({ status: "PAID", total: "0.01" })
      .eq("id", reference.order_id);

    // Vérité terrain via service_role.
    const { data: rows } = await service
      .from("orders")
      .select("id, status, total, currency")
      .eq("buyer_id", buyerAId);
    expect(rows).not.toBeNull();

    const target = (rows ?? []).find((row) => row.id === reference.order_id);
    if (target === undefined) throw new Error("Commande de référence introuvable");
    expect(target.status).toBe("PENDING");                 // pas de bascule en PAID
    expect(dec(target.total as string | number)).toBe(reference.total); // montant intact

    // Aucune commande fantôme injectée par l'INSERT.
    for (const row of rows ?? []) {
      expect(row.status).toBe("PENDING");
    }
  });

  it("[T11] numéros de commande uniques et séquentiels", async () => {
    const aClient = await clientFor(`OrderBuyerA${suffix}`);
    const numbers = new Set<string>();
    for (let i = 0; i < 3; i += 1) {
      const { data, error } = await aClient.rpc("create_checkout_order", {
        p_product_ids: [pMultiA],
      });
      expect(error).toBeNull();
      numbers.add((data as { order_number: string }).order_number);
    }
    expect(numbers.size).toBe(3);
  });
});
