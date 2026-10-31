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
const password = "Passw0rd!Test";
const createdUsers: User[] = [];
let service: SupabaseClient;
let adminClient: SupabaseClient;
let vendorClient: SupabaseClient;
let vendorId = "";

async function createUser(name: string): Promise<{ user: User; client: SupabaseClient }> {
  const email = `${name.toLowerCase()}.${suffix}@example.com`;
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name },
  });
  expect(error).toBeNull();
  if (data.user === null) throw new Error("Utilisateur non créé");
  createdUsers.push(data.user);

  const client = createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword({ email, password });
  expect(signInError).toBeNull();
  return { user: data.user, client };
}

beforeAll(async () => {
  service = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const vendor = await createUser("VendorModeration");
  const admin = await createUser("AdminModeration");
  vendorClient = vendor.client;
  adminClient = admin.client;

  const { error: roleError } = await service
    .from("profiles")
    .update({ role: "ADMIN" })
    .eq("id", admin.user.id);
  expect(roleError).toBeNull();

  const { data, error } = await vendorClient
    .from("vendors")
    .insert({
      user_id: vendor.user.id,
      store_name: `Boutique moderation ${suffix}`,
      slug: `moderation-${suffix}`,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  vendorId = data?.id ?? "";
}, 60_000);

afterAll(async () => {
  for (const user of createdUsers.reverse()) {
    await service.auth.admin.deleteUser(user.id);
  }
}, 60_000);

describe("Phase 10 — Modération administrateur des vendeurs", () => {
  it("refuse la transition demandée par le vendeur", async () => {
    const { error } = await vendorClient.rpc("admin_transition_vendor", {
      p_vendor: vendorId,
      p_target: "ACTIVE",
    });
    expect(error).not.toBeNull();
  });

  it("approuve une boutique PENDING puis refuse une transition invalide", async () => {
    const { error } = await adminClient.rpc("admin_transition_vendor", {
      p_vendor: vendorId,
      p_target: "ACTIVE",
    });
    expect(error).toBeNull();

    const { data } = await service.from("vendors").select("status").eq("id", vendorId).single();
    expect(data?.status).toBe("ACTIVE");

    const { error: invalidTransitionError } = await adminClient.rpc("admin_transition_vendor", {
      p_vendor: vendorId,
      p_target: "REJECTED",
    });
    expect(invalidTransitionError).not.toBeNull();
  });

  it("suspend puis réactive une boutique ACTIVE", async () => {
    const { error: suspendError } = await adminClient.rpc("admin_transition_vendor", {
      p_vendor: vendorId,
      p_target: "SUSPENDED",
    });
    expect(suspendError).toBeNull();

    const { error: reactivateError } = await adminClient.rpc("admin_transition_vendor", {
      p_vendor: vendorId,
      p_target: "ACTIVE",
    });
    expect(reactivateError).toBeNull();

    const { data } = await service.from("vendors").select("status").eq("id", vendorId).single();
    expect(data?.status).toBe("ACTIVE");
  });
});
