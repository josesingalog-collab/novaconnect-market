/**
 * PHASE 7 — Paiement simulé : RPC `confirm_order_payment` (0007, non modifiée),
 * idempotence ledger, alignement croisé, refus d'accès, dédoublonnage webhook.
 *
 * Couverture :
 *  [T1] happy path : PENDING→PAID, paid_at, platform_fee = Σ commissions,
 *       crédits SALE_CREDIT = vendor_amount par ligne, audit 'order.paid' ;
 *  [T2] rejeu idempotent : 2e appel → no-op silencieux, un seul crédit/ligne ;
 *  [T3] commande déjà PAID + paiement revenu PENDING → alignement paiement,
 *       AUCUN nouveau crédit ;
 *  [T4] paiement non-PENDING (FAILED) → exception « non confirmable » ;
 *  [T5] anon / authenticated → exécution refusée (grant service_role seul) ;
 *  [T6] webhook : UNIQUE(provider, event_hash) rejette le doublon (23505).
 *
 * Suite autonome : utilisateurs supprimés en fin d'exécution (cascade).
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
const createdEventIds: string[] = [];

let buyerId = "";
let vendorUId = "";
let vendorWId = "";

let pUsd10 = "";
let pUsd999 = "";

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

async function buyerClient(): Promise<SupabaseClient> {
  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: `PayBuyer${suffix}.${suffix}@example.com`.toLowerCase(),
    password: PASSWORD,
  });
  expect(error).toBeNull();
  return client;
}

async function makeActiveVendor(
  userName: string,
  slugBase: string,
): Promise<{ vendorRowId: string; bps: number }> {
  const { user } = await makeUser(userName);
  const slug = `${slugBase}-${suffix}`;
  const { data: vendor, error: insErr } = await service
    .from("vendors")
    .insert({ user_id: user.id, store_name: `Shop ${slugBase}`, slug })
    .select("id, commission_rate_bps")
    .single();
  expect(insErr).toBeNull();
  const { error: actErr } = await service
    .from("vendors")
    .update({ status: "ACTIVE" })
    .eq("id", vendor?.id ?? "");
  expect(actErr).toBeNull();
  return { vendorRowId: vendor?.id ?? "", bps: vendor?.commission_rate_bps ?? 1000 };
}

async function makePublishedProduct(params: {
  vendorRowId: string;
  title: string;
  price: string;
}): Promise<string> {
  const slug = `${params.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}-${Math.random().toString(36).slice(2, 8)}`;
  const { data, error } = await service
    .from("products")
    .insert({
      vendor_id: params.vendorRowId,
      title: params.title,
      slug,
      price: params.price,
      currency: "USD",
      status: "PUBLISHED",
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data?.id ?? "";
}

/** Passe par la même RPC que le vrai checkout (Phase 6). */
async function createOrderViaCheckout(
  productIds: string[],
): Promise<{ orderId: string; items: Array<{ itemId: string; vendorAmount: string; commissionAmount: string }> }> {
  const client = await buyerClient();
  const { data, error } = await client.rpc("create_checkout_order", {
    p_product_ids: productIds,
  });
  if (error !== null) throw new Error(`checkout refusé : ${error.message}`);
  const order = data as { order_id: string };
  const { data: rows } = await service
    .from("order_items")
    .select("id, vendor_amount, commission_amount")
    .eq("order_id", order.order_id);
  return {
    orderId: order.order_id,
    // D-016 : numeric entier arrive en nombre JSON → canoniser immédiatement.
    items: (rows ?? []).map((row) => ({
      itemId: row.id,
      vendorAmount: dec(row.vendor_amount),
      commissionAmount: dec(row.commission_amount),
    })),
  };
}

async function paymentFor(orderId: string): Promise<{
  id: string;
  status: string;
  amount: string;
  confirmed_at: string | null;
}> {
  const { data } = await service.from("payments").select("*").eq("order_id", orderId).limit(1);
  const row = (data ?? [])[0];
  if (row === undefined) throw new Error("Paiement introuvable");
  return {
    id: row.id,
    status: row.status,
    amount: String(row.amount),
    confirmed_at: row.confirmed_at,
  };
}

/** D-016 : numeric entier sérialisé en nombre JSON — canonisation. */
function dec(value: string | number): string {
  return typeof value === "number" ? value.toFixed(2) : value;
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const b = await makeUser(`PayBuyer${suffix}`);
  buyerId = b.user.id;
  const vu = await makeActiveVendor(`PayVendorU${suffix}`, `payvendoru-${suffix}`);
  vendorUId = vu.vendorRowId;
  const vw = await makeActiveVendor(`PayVendorW${suffix}`, `payvendorw-${suffix}`);
  vendorWId = vw.vendorRowId;

  pUsd10 = await makePublishedProduct({ vendorRowId: vendorUId, title: "Pay produit dix", price: "10.00" });
  pUsd999 = await makePublishedProduct({ vendorRowId: vendorWId, title: "Pay produit 999", price: "9.99" });
});

afterAll(async () => {
  if (createdEventIds.length > 0) {
    await service.from("payment_events").delete().in("id", createdEventIds);
  }
  for (const user of createdUsers) {
    await service.auth.admin.deleteUser(user.id);
  }
});

describe("Phase 7 — Paiement simulé & idempotence", () => {
  it("[T1] happy path : PENDING→PAID, ledger crédité, fees, audit", async () => {
    const { orderId, items } = await createOrderViaCheckout([pUsd10]);

    const before = await paymentFor(orderId);
    expect(before.status).toBe("PENDING");

    const { error } = await service.rpc("confirm_order_payment", { p_payment_id: before.id });
    expect(error).toBeNull();

    // Paiement confirmé.
    const after = await paymentFor(orderId);
    expect(after.status).toBe("PAID");
    expect(after.confirmed_at).not.toBeNull();

    // Commande payée, paid_at posé, platform_fee recalculé.
    const { data: order } = await service
      .from("orders")
      .select("status, paid_at, platform_fee, total")
      .eq("id", orderId)
      .single();
    expect(order?.status).toBe("PAID");
    expect(order?.paid_at).not.toBeNull();
    expect(dec((order as { platform_fee: string | number }).platform_fee)).toBe(
      dec(items.reduce((sum, item) => sum + Number(item.commissionAmount), 0)),
    );

    // Ledger : exactement un SALE_CREDIT par ligne, montant = vendor_amount.
    const { data: credits } = await service
      .from("vendor_ledger_entries")
      .select("order_item_id, amount, entry_type")
      .in("reference", items.map((item) => item.itemId));
    expect(credits?.length).toBe(items.length);
    for (const credit of credits ?? []) {
      expect(credit.entry_type).toBe("SALE_CREDIT");
      const expected = items.find((item) => item.itemId === credit.order_item_id);
      expect(expected).toBeDefined();
      expect(dec(credit.amount)).toBe(dec(expected?.vendorAmount ?? ""));
    }
    // Somme des crédits + fee = total commande.
    const creditsSum = (credits ?? []).reduce((sum, c) => sum + Number(c.amount), 0);
    expect(dec(creditsSum + Number((order as { platform_fee: string | number }).platform_fee))).toBe(
      dec((order as { total: string | number }).total),
    );

    // Audit.
    const { data: audits } = await service
      .from("audit_logs")
      .select("id")
      .eq("action", "order.paid")
      .eq("entity_id", orderId);
    expect(audits?.length).toBe(1);
  });

  it("[T2] rejeu idempotent : aucun double crédit, no-op silencieux", async () => {
    const { orderId, items } = await createOrderViaCheckout([pUsd10]);
    const payment = await paymentFor(orderId);

    await service.rpc("confirm_order_payment", { p_payment_id: payment.id });
    const { count: creditsAfterFirst } = await service
      .from("vendor_ledger_entries")
      .select("id", { count: "exact", head: true })
      .in("reference", items.map((item) => item.itemId));
    expect(creditsAfterFirst).toBe(items.length);

    // Rejoue le webhook : no-op silencieux attendu.
    const { error } = await service.rpc("confirm_order_payment", { p_payment_id: payment.id });
    expect(error).toBeNull();

    const { count: creditsAfterReplay } = await service
      .from("vendor_ledger_entries")
      .select("id", { count: "exact", head: true })
      .in("reference", items.map((item) => item.itemId));
    expect(creditsAfterReplay).toBe(items.length);

    const replayed = await paymentFor(orderId);
    expect(replayed.status).toBe("PAID");
  });

  it("[T3] commande déjà PAID → aligne le paiement, zéro nouveau crédit", async () => {
    const { orderId, items } = await createOrderViaCheckout([pUsd999]);
    const payment = await paymentFor(orderId);

    await service.rpc("confirm_order_payment", { p_payment_id: payment.id });

    // Simule un paiement « en retard » : la commande est déjà payée mais le
    // paiement repasse PENDING (webhook arrivé deux fois dans le désordre).
    await service.from("payments").update({ status: "PENDING", confirmed_at: null }).eq("id", payment.id);

    const { count: creditsBefore } = await service
      .from("vendor_ledger_entries")
      .select("id", { count: "exact", head: true })
      .in("reference", items.map((item) => item.itemId));

    const { error } = await service.rpc("confirm_order_payment", { p_payment_id: payment.id });
    expect(error).toBeNull();

    const aligned = await paymentFor(orderId);
    expect(aligned.status).toBe("PAID");
    expect(aligned.confirmed_at).not.toBeNull();

    const { count: creditsAfter } = await service
      .from("vendor_ledger_entries")
      .select("id", { count: "exact", head: true })
      .in("reference", items.map((item) => item.itemId));
    expect(creditsAfter).toBe(creditsBefore);
  });

  it("[T4] paiement non-PENDING → exception explicite", async () => {
    const { orderId } = await createOrderViaCheckout([pUsd10]);
    const payment = await paymentFor(orderId);

    await service.from("payments").update({ status: "FAILED" }).eq("id", payment.id);

    const { data, error } = await service.rpc("confirm_order_payment", { p_payment_id: payment.id });
    expect(data ?? null).toBeNull();
    if (error === null) throw new Error("Refus attendu pour un paiement FAILED");
    expect(/non confirmable/i.test(error.message)).toBe(true);

    // La commande reste inchangée.
    const { data: order } = await service.from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("PENDING");
  });

  it("[T5] anon et authenticated ne peuvent pas exécuter la RPC", async () => {
    const { orderId } = await createOrderViaCheckout([pUsd10]);
    const payment = await paymentFor(orderId);

    // Client authentifié NON privilégié.
    const signedIn = await buyerClient();
    const { error: authErr } = await signedIn.rpc("confirm_order_payment", {
      p_payment_id: payment.id,
    });
    expect(authErr).not.toBeNull();

    // Client anonyme.
    const anon = createClient(URL, ANON, { auth: { persistSession: false } });
    const { error: anonErr } = await anon.rpc("confirm_order_payment", {
      p_payment_id: payment.id,
    });
    expect(anonErr).not.toBeNull();

    // La commande n'a PAS été confirmée entre-temps.
    const { data: order } = await service.from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("PENDING");
    void buyerId;
  });

  it("[T6] webhook : doublon (provider, event_hash) rejeté par contrainte", async () => {
    const eventHash = `phase7-${suffix}-${Math.random().toString(36).slice(2, 10)}`;
    const base = {
      provider: "mock",
      event_type: "payment.confirmed",
      event_hash: eventHash,
      payload: { test: suffix },
    };

    const first = await service.from("payment_events").insert(base).select("id").single();
    expect(first.error).toBeNull();
    if (first.data !== null && first.data !== undefined) createdEventIds.push(first.data.id);

    const second = await service.from("payment_events").insert(base).select("id");
    expect(second.error).not.toBeNull();
    expect(second.error?.code).toBe("23505");
  });
});
