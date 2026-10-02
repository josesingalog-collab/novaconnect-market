/**
 * Smoke Phase 7 — webhook /api/webhooks/payment contre le serveur de dev.
 * S1 : signature valide → 200 · S2 : signature invalide → 401
 * S3 : même webhook rejoué → 200 {replay:true} sans double traitement.
 */
import { createClient } from "@supabase/supabase-js";
import { createHmac, createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:3000";
const envText = readFileSync(".env.local", "utf8");
const pick = (key) => {
  const line = envText.split("\n").find((l) => l.startsWith(key + "="));
  if (!line) throw new Error(`Variable manquante : ${key}`);
  return line.slice(key.length + 1).trim();
};

const URL = pick("NEXT_PUBLIC_SUPABASE_URL");
const ANON = pick("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const SERVICE_KEY = pick("SUPABASE_SERVICE_ROLE_KEY");
const SECRET = pick("PAYMENT_WEBHOOK_SECRET");

const suffix = Date.now().toString(36);
let createdUserId = null;
let vendorRowId = null;
let eventId = null;

const service = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(message) {
  console.error("ÉCHEC :", message);
  process.exitCode = 1;
}

async function postWebhook(body, signatureHeader) {
  const headers = { "content-type": "application/json" };
  if (signatureHeader !== null) headers["x-nc-signature"] = signatureHeader;
  const res = await fetch(`${BASE}/api/webhooks/payment`, {
    method: "POST",
    headers,
    body,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* corps non JSON */
  }
  return { status: res.status, json };
}

try {
  // --- Fixture : acheteur + boutique active + produit publié ---
  const email = `smoke7.${suffix}@example.com`;
  const { data: created, error: userErr } = await service.auth.admin.createUser({
    email,
    password: "Passw0rd!Smoke",
    email_confirm: true,
  });
  if (userErr !== null || created.user === null) throw new Error("création user");
  createdUserId = created.user.id;

  const slug = `smoke7-${suffix}`;
  const { data: vendor, error: vErr } = await service
    .from("vendors")
    .insert({ user_id: createdUserId, store_name: "Smoke 7", slug })
    .select("id")
    .single();
  if (vErr !== null) throw new Error(`vendor : ${vErr.message}`);
  vendorRowId = vendor.id;
  await service.from("vendors").update({ status: "ACTIVE" }).eq("id", vendorRowId);

  const { data: product, error: pErr } = await service
    .from("products")
    .insert({
      vendor_id: vendorRowId,
      title: "Smoke produit 7",
      slug: `smoke-p7-${suffix}`,
      price: "4.00",
      currency: "USD",
      status: "PUBLISHED",
    })
    .select("id")
    .single();
  if (pErr !== null) throw new Error(`product : ${pErr.message}`);

  // --- Commande PENDING via la vraie RPC de checkout ---
  const anon = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await anon.auth.signInWithPassword({
    email,
    password: "Passw0rd!Smoke",
  });
  if (signInErr !== null) throw new Error("signin");
  const { data: checkout, error: checkoutErr } = await anon.rpc("create_checkout_order", {
    p_product_ids: [product.id],
  });
  if (checkoutErr !== null) throw new Error(`checkout : ${checkoutErr.message}`);
  const orderId = checkout.order_id;

  const { data: payRows } = await service
    .from("payments")
    .select("id")
    .eq("order_id", orderId)
    .limit(1);
  const paymentId = payRows?.[0]?.id;
  if (!paymentId) throw new Error("payment introuvable");

  // --- S1 : signature valide → 200, commande PAID ---
  const body = JSON.stringify({
    payment_id: paymentId,
    provider: "mock",
    event_type: "payment.confirmed",
  });
  const sig = createHmac("sha256", SECRET).update(body, "utf8").digest("hex");

  const s1 = await postWebhook(body, sig);
  if (s1.status !== 200 || s1.json?.ok !== true || s1.json?.replay === true) {
    fail(`S1 attendu 200 {ok:true}, reçu ${s1.status} ${JSON.stringify(s1.json)}`);
  } else {
    console.log("S1 ✓ signature valide → 200 {ok:true}");
  }

  const { data: orderAfter } = await service
    .from("orders")
    .select("status")
    .eq("id", orderId)
    .single();
  if (orderAfter?.status !== "PAID") {
    fail(`S1bis commande attendue PAID, reçue ${orderAfter?.status}`);
  } else {
    console.log("S1bis ✓ commande passée PAID en base");
  }

  // --- S2 : signature invalide → 401 ---
  const s2 = await postWebhook(body, "a".repeat(64));
  if (s2.status !== 401) {
    fail(`S2 attendu 401, reçu ${s2.status} ${JSON.stringify(s2.json)}`);
  } else {
    console.log("S2 ✓ signature invalide → 401");
  }

  // --- S3 : rejeu du MÊME webhook → 200 {replay:true}, aucun double traitement ---
  const s3 = await postWebhook(body, sig);
  if (s3.status !== 200 || s3.json?.ok !== true || s3.json?.replay !== true) {
    fail(`S3 attendu 200 {replay:true}, reçu ${s3.status} ${JSON.stringify(s3.json)}`);
  } else {
    console.log("S3 ✓ rejeu → 200 {replay:true}");
  }

  const eventHash = createHash("sha256").update(body, "utf8").digest("hex");
  const { data: events } = await service
    .from("payment_events")
    .select("id")
    .eq("provider", "mock")
    .eq("event_hash", eventHash);
  const { data: items } = await service.from("order_items").select("id").eq("order_id", orderId);
  const { data: credits } = await service
    .from("vendor_ledger_entries")
    .select("id")
    .in(
      "reference",
      (items ?? []).map((i) => i.id),
    );

  if ((events ?? []).length !== 1) {
    fail(`S3bis événements journalisés attendus 1, reçus ${(events ?? []).length}`);
  } else {
    console.log("S3bis ✓ exactement 1 ligne payment_events");
  }
  if ((credits ?? []).length !== 1) {
    fail(`S3ter crédits ledger attendus 1, reçus ${(credits ?? []).length}`);
  } else {
    console.log("S3ter ✓ exactement 1 crédit vendeur (pas de double traitement)");
  }

  eventId = events?.[0]?.id ?? null;
} catch (error) {
  fail(String(error));
  process.exitCode = 1;
} finally {
  // --- Nettoyage ---
  try {
    if (eventId !== null) await service.from("payment_events").delete().eq("id", eventId);
    if (createdUserId !== null) {
      await service.from("orders").delete().eq("buyer_id", createdUserId);
      await service.auth.admin.deleteUser(createdUserId);
    }
    if (vendorRowId !== null) await service.from("vendors").delete().eq("id", vendorRowId);
    console.log(
      process.exitCode === 1
        ? "--- Smoke en échec (nettoyage effectué)"
        : "--- Smoke OK, nettoyage effectué",
    );
  } catch {
    console.error("Nettoyage partiel — vérifier les fixtures smoke7.");
  }
}
