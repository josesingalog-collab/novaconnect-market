import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

const URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const ANON = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const SERVICE = process.env["SUPABASE_SERVICE_ROLE_KEY"];

const integration = URL && ANON && SERVICE ? describe : describe.skip;
const suffix = Date.now().toString(36);
const password = "Passw0rd!Test";
let service: SupabaseClient;
let vendorClient: SupabaseClient;
let vendorId = "";
let userId = "";
let createdUser: User | null = null;

integration("Phase 10.7-I - boutique vendeur", () => {
  beforeAll(async () => {
    service = createClient(URL!, SERVICE!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await service.auth.admin.createUser({
      email: `vendor-boutique.${suffix}@example.com`,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Vendor Boutique" },
    });
    expect(error).toBeNull();
    if (data.user === null) throw new Error("Utilisateur non créé");
    createdUser = data.user;
    userId = data.user.id;

    vendorClient = createClient(URL!, ANON!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await vendorClient.auth.signInWithPassword({
      email: `vendor-boutique.${suffix}@example.com`,
      password,
    });
    const { data: vendor, error: vendorError } = await vendorClient
      .from("vendors")
      .insert({
        user_id: userId,
        store_name: "Boutique intégration",
        slug: `boutique-integration-${suffix}`,
      })
      .select("id")
      .single();
    expect(vendorError).toBeNull();
    vendorId = vendor?.id ?? "";
    await service.from("vendors").update({ status: "ACTIVE" }).eq("id", vendorId);
  });

  afterAll(async () => {
    if (createdUser !== null) await service.auth.admin.deleteUser(createdUser.id);
  });

  it("ACTIVE peut modifier uniquement store_name et description; slug et champs protégés restent inchangés", async () => {
    const { data: before } = await service
      .from("vendors")
      .select("slug, status, user_id, commission_rate_bps, logo_url, payout_phone, updated_at")
      .eq("id", vendorId)
      .single();
    const { data, error } = await vendorClient
      .from("vendors")
      .update({ store_name: "Boutique modifiée", description: "Description modifiée" })
      .eq("id", vendorId)
      .select(
        "store_name, description, slug, status, user_id, commission_rate_bps, logo_url, payout_phone, updated_at",
      )
      .single();

    expect(error).toBeNull();
    expect(data?.store_name).toBe("Boutique modifiée");
    expect(data?.description).toBe("Description modifiée");
    expect(data?.slug).toBe(before?.slug);
    expect(data?.status).toBe(before?.status);
    expect(data?.user_id).toBe(before?.user_id);
    expect(data?.commission_rate_bps).toBe(before?.commission_rate_bps);
    expect(data?.logo_url).toBe(before?.logo_url);
    expect(data?.payout_phone).toBe(before?.payout_phone);
    expect(data?.updated_at).not.toBe(before?.updated_at);
  });

  it("le trigger SQL rejette une modification directe du slug", async () => {
    const { error } = await vendorClient
      .from("vendors")
      .update({ slug: `slug-interdit-${suffix}` })
      .eq("id", vendorId);

    expect(error).not.toBeNull();
    expect(error?.message).toMatch(/slug.*ne peut pas être modifié/i);
  });
});
