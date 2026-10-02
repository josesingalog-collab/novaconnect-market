/**
 * TESTS D'INTÉGRATION PHASE 10.7-G — Backend finances.
 *
 * Couverture :
 *  - Transitions admin (approve, process, mark_paid, reject) ;
 *  - RLS / sécurité des RPC admin ;
 *  - Validation payout_details (mobile_money, bank) ;
 *  - CDF toujours désactivé ;
 *  - Cohérence des soldes USD avant/après retrait ;
 *  - Idempotence du débit ledger sur PAID.
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
let vendorA: SupabaseClient;
let adminClient: SupabaseClient;
let buyerId = "";
let vendorAId = "";
let shopAId = "";
let productAId = "";
let orderId = "";
let paymentId = "";
let withdrawalId = "";

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

async function createAdminUser(): Promise<{ client: SupabaseClient; adminUserId: string }> {
  const email = `admin${suffix}@example.com`;
  const { data: adminUser, error: adminErr } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: `Admin${suffix}`, role: "ADMIN" },
  });
  expect(adminErr).toBeNull();
  if (adminUser === null || adminUser.user === null) throw new Error("Admin non créé");

  const { error: profileErr } = await service
    .from("profiles")
    .update({ role: "ADMIN", status: "ACTIVE" })
    .eq("id", adminUser.user.id);
  expect(profileErr).toBeNull();

  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  expect(signInError).toBeNull();

  return { client, adminUserId: adminUser.user.id };
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const b = await makeUser(`Buyer${suffix}`);
  buyerId = b.user.id;

  const a = await makeUser(`VendeurA${suffix}`);
  vendorAId = a.user.id;
  vendorA = a.client;

  const admin = await createAdminUser();
  adminClient = admin.client;

  const { data: shop } = await vendorA
    .from("vendors")
    .insert({
      user_id: vendorAId,
      store_name: `Boutique A ${suffix}`,
      slug: `boutique-a-${suffix}`,
      description: "Boutique de test",
    })
    .select("id")
    .single();
  shopAId = shop?.id ?? "";

  const { error: activateErr } = await service
    .from("vendors")
    .update({ status: "ACTIVE" })
    .eq("id", shopAId);
  expect(activateErr).toBeNull();

  const { data: product } = await vendorA
    .from("products")
    .insert({
      vendor_id: shopAId,
      title: `Formation CAD ${suffix}`,
      slug: `formation-cad-${suffix}`,
      short_description: "Produit de test",
      price: "100.00",
      currency: "USD",
    })
    .select("id")
    .single();
  productAId = product?.id ?? "";

  const { error: pubErr } = await service
    .from("products")
    .update({ status: "PUBLISHED" })
    .eq("id", productAId);
  expect(pubErr).toBeNull();

  const orderRes = await service
    .from("orders")
    .insert({ buyer_id: buyerId, total: "100.00", currency: "USD" })
    .select("id")
    .single();
  orderId = orderRes.data?.id ?? "";

  const { error: itemError } = await service
    .from("order_items")
    .insert({
      order_id: orderId,
      product_id: productAId,
      vendor_id: shopAId,
      product_title: `Formation CAD ${suffix}`,
      unit_price: "100.00",
      quantity: 1,
      line_total: "100.00",
      commission_rate_bps: 1000,
      commission_amount: "10.00",
      vendor_amount: "90.00",
      currency: "USD",
    })
    .select("id")
    .single();
  expect(itemError).toBeNull();

  const payRes = await service
    .from("payments")
    .insert({
      order_id: orderId,
      provider: "mock",
      provider_reference: `mock-${suffix}`,
      amount: "100.00",
      currency: "USD",
    })
    .select("id")
    .single();
  paymentId = payRes.data?.id ?? "";

  const { error: confErr } = await service.rpc("confirm_order_payment", {
    p_payment_id: paymentId,
  });
  expect(confErr).toBeNull();
}, 60_000);

afterAll(async () => {
  for (const id of [buyerId, vendorAId]) {
    try {
      await service.auth.admin.deleteUser(id);
    } catch {}
  }
}, 60_000);

describe("Phase 10.7-G — Transitions admin des retraits", () => {
  describe("ADMIN peut approuver un PENDING", () => {
    it("crée un retrait PENDING", async () => {
      const { data, error } = await vendorA.rpc("request_withdrawal", {
        p_currency: "USD",
        p_amount: "30.00",
        p_method: "mobile_money",
        p_payout: { phone: "+243900000000", operator: "Vodacom" },
      });
      expect(error).toBeNull();
      withdrawalId = data as string;
      expect(withdrawalId).toBeTruthy();
    });

    it("approve_withdrawal change PENDING → APPROVED", async () => {
      const { error } = await adminClient.rpc("approve_withdrawal", { p_withdrawal: withdrawalId });
      expect(error).toBeNull();

      const { data } = await service
        .from("withdrawals")
        .select("status")
        .eq("id", withdrawalId)
        .single();
      expect(data?.status).toBe("APPROVED");
    });
  });

  describe("Non-admin ne peut pas approuver", () => {
    it("vendorA ne peut pas approuver", async () => {
      const { error } = await vendorA.rpc("approve_withdrawal", { p_withdrawal: withdrawalId });
      expect(error).not.toBeNull();
    });
  });

  describe("APPROVED ne peut pas être approuvé une deuxième fois", () => {
    it("deuxième approve échoue", async () => {
      const { error } = await adminClient.rpc("approve_withdrawal", { p_withdrawal: withdrawalId });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("Transition non autorisee");
    });
  });

  describe("ADMIN peut passer APPROVED → PROCESSING", () => {
    it("process_withdrawal change APPROVED → PROCESSING", async () => {
      const { error } = await adminClient.rpc("process_withdrawal", { p_withdrawal: withdrawalId });
      expect(error).toBeNull();

      const { data } = await service
        .from("withdrawals")
        .select("status")
        .eq("id", withdrawalId)
        .single();
      expect(data?.status).toBe("PROCESSING");
    });
  });

  describe("PENDING ne peut pas passer directement → PROCESSING", () => {
    it("process sur PENDING échoue", async () => {
      const { data: w } = await vendorA.rpc("request_withdrawal", {
        p_currency: "USD",
        p_amount: "30.00",
        p_method: "bank",
        p_payout: { account_number: "123456", account_name: "Test", bank_name: "Rawbank" },
      });
      const newId = w as string;

      const { error } = await adminClient.rpc("process_withdrawal", { p_withdrawal: newId });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("Transition non autorisee");

      await adminClient.rpc("reject_withdrawal", { p_withdrawal: newId });
    });
  });

  describe("ADMIN peut passer PROCESSING → PAID", () => {
    it("mark_withdrawal_paid change PROCESSING → PAID", async () => {
      const { error } = await adminClient.rpc("mark_withdrawal_paid", {
        p_withdrawal: withdrawalId,
      });
      expect(error).toBeNull();

      const { data } = await service
        .from("withdrawals")
        .select("status")
        .eq("id", withdrawalId)
        .single();
      expect(data?.status).toBe("PAID");
    });
  });

  describe("PAID crée exactement un WITHDRAWAL_DEBIT", () => {
    it("un seul débit ledger", async () => {
      const { data: debits } = await service
        .from("vendor_ledger_entries")
        .select("id, amount")
        .eq("withdrawal_id", withdrawalId)
        .eq("entry_type", "WITHDRAWAL_DEBIT");
      expect(debits ?? []).toHaveLength(1);
      expect(Number((debits ?? [])[0]?.amount)).toBe(-30);
    });

    it("rejouer PAID ne crée pas de deuxième débit", async () => {
      await service.from("withdrawals").update({ status: "PAID" }).eq("id", withdrawalId);

      const { data: debits } = await service
        .from("vendor_ledger_entries")
        .select("id")
        .eq("withdrawal_id", withdrawalId)
        .eq("entry_type", "WITHDRAWAL_DEBIT");
      expect(debits ?? []).toHaveLength(1);
    });
  });

  describe("ADMIN peut rejeter un PENDING", () => {
    it("crée un nouveau retrait PENDING", async () => {
      const { data, error } = await vendorA.rpc("request_withdrawal", {
        p_currency: "USD",
        p_amount: "30.00",
        p_method: "mobile_money",
        p_payout: { phone: "+243900000001", operator: "Airtel" },
      });
      expect(error).toBeNull();
      withdrawalId = data as string;
    });

    it("reject_withdrawal change PENDING → REJECTED", async () => {
      const { error } = await adminClient.rpc("reject_withdrawal", { p_withdrawal: withdrawalId });
      expect(error).toBeNull();

      const { data } = await service
        .from("withdrawals")
        .select("status")
        .eq("id", withdrawalId)
        .single();
      expect(data?.status).toBe("REJECTED");
    });
  });

  describe("APPROVED ne peut pas être rejeté", () => {
    it("reject sur APPROVED échoue", async () => {
      const { data: w } = await vendorA.rpc("request_withdrawal", {
        p_currency: "USD",
        p_amount: "30.00",
        p_method: "mobile_money",
        p_payout: { phone: "+243900000002", operator: "Airtel" },
      });
      const newId = w as string;
      await adminClient.rpc("approve_withdrawal", { p_withdrawal: newId });

      const { error } = await adminClient.rpc("reject_withdrawal", { p_withdrawal: newId });
      expect(error).not.toBeNull();
      expect(error?.message).toContain("Transition non autorisee");
    });
  });

  describe("Vendeur ne peut pas exécuter les RPC admin", () => {
    it("vendorA ne peut pas process_withdrawal", async () => {
      const { data: w } = await vendorA.rpc("request_withdrawal", {
        p_currency: "USD",
        p_amount: "30.00",
        p_method: "mobile_money",
        p_payout: { phone: "+243900000003", operator: "Airtel" },
      });
      const newId = w as string;

      const { error } = await vendorA.rpc("process_withdrawal", { p_withdrawal: newId });
      expect(error).not.toBeNull();
    });
  });
});

describe("Phase 10.7-G — Validation payout_details", () => {
  it("payout_details mobile_money valide", async () => {
    const { error } = await vendorA.rpc("validate_withdrawal_payout", {
      p_method: "mobile_money",
      p_payout: { phone: "+243999999999", operator: "Vodacom" },
    });
    expect(error).toBeNull();
  });

  it("payout_details mobile_money invalide — opérateur absent", async () => {
    const { error } = await vendorA.rpc("validate_withdrawal_payout", {
      p_method: "mobile_money",
      p_payout: { phone: "+243999999998" },
    });
    expect(error).not.toBeNull();
  });

  it("payout_details bank valide", async () => {
    const { error } = await vendorA.rpc("validate_withdrawal_payout", {
      p_method: "bank",
      p_payout: { account_number: "987654", account_name: "Jean Dupont", bank_name: "Rawbank" },
    });
    expect(error).toBeNull();
  });

  it("payout_details bank invalide — account_name absent", async () => {
    const { error } = await vendorA.rpc("validate_withdrawal_payout", {
      p_method: "bank",
      p_payout: { account_number: "987654", bank_name: "Rawbank" },
    });
    expect(error).not.toBeNull();
  });
});

describe("Phase 10.7-G — CDF et cohérence des soldes", () => {
  it("CDF reste refusé", async () => {
    const { error } = await vendorA.rpc("request_withdrawal", {
      p_currency: "CDF",
      p_amount: "100000.00",
      p_method: "mobile_money",
      p_payout: { phone: "+243999999997", operator: "Vodacom" },
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("indisponibles");
  });

  it("soldes USD cohérents avant/après retrait", async () => {
    const { data: bal } = await vendorA.rpc("get_my_vendor_balances");
    const usd = (bal as Array<Record<string, unknown>>)?.find((r) => r["currency"] === "USD");
    expect(Number(usd?.["accounting_balance"])).toBe(60);
  });

  it("aucun dépassement du disponible", async () => {
    const { data: bal } = await vendorA.rpc("get_my_vendor_balances");
    const usd = (bal as Array<Record<string, unknown>>)?.find((r) => r["currency"] === "USD");
    const available = Number(usd?.["available_balance"]);
    expect(available).toBeGreaterThanOrEqual(0);
  });
});
