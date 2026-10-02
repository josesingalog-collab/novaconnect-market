import { describe, expect, it, vi } from "vitest";
import { vendorUpdateSchema } from "@/schemas/vendor-update";

describe("vendorUpdateSchema", () => {
  it("accepte un nom valide et normalise la description", () => {
    expect(
      vendorUpdateSchema.parse({
        storeName: "  Boutique Nova  ",
        description: "  Une description  ",
      }),
    ).toEqual({ storeName: "Boutique Nova", description: "Une description" });
  });

  it("rejette un nom trop court", () => {
    expect(vendorUpdateSchema.safeParse({ storeName: "AB" }).success).toBe(false);
  });

  it("rejette un nom trop long", () => {
    expect(vendorUpdateSchema.safeParse({ storeName: "A".repeat(61) }).success).toBe(false);
  });

  it("rejette une description trop longue", () => {
    expect(
      vendorUpdateSchema.safeParse({ storeName: "Boutique", description: "A".repeat(501) }).success,
    ).toBe(false);
  });

  it("normalise une description vide en null", () => {
    expect(vendorUpdateSchema.parse({ storeName: "Boutique", description: "   " })).toEqual({
      storeName: "Boutique",
      description: null,
    });
  });

  it("rejette les champs protégés", () => {
    expect(
      vendorUpdateSchema.safeParse({ storeName: "Boutique", slug: "pirate", status: "ACTIVE" })
        .success,
    ).toBe(false);
  });
});

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));

import { getMyVendor, updateVendor } from "@/services/vendor/boutique";

function makeDb(options: {
  userId?: string | null;
  vendor?: Record<string, unknown> | null;
  updatedVendor?: Record<string, unknown> | null;
  updateError?: Error | null;
}) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };
  query.maybeSingle
    .mockResolvedValueOnce({ data: options.vendor ?? null, error: null })
    .mockResolvedValueOnce({
      data: options.updatedVendor ?? null,
      error: options.updateError ?? null,
    });

  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: options.userId ? { id: options.userId } : null },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue(query),
    query,
  };
}

const activeVendor = {
  id: "vendor-a",
  user_id: "user-a",
  store_name: "Avant",
  slug: "avant",
  description: "Avant description",
  status: "ACTIVE",
  logo_url: "https://example.test/logo.png",
  payout_phone: "+243000000",
  commission_rate_bps: 1000,
  updated_at: "2026-09-29T00:00:00.000Z",
};

describe("service boutique vendeur", () => {
  it("getMyVendor résout la boutique depuis auth.uid()", async () => {
    const db = makeDb({ userId: "user-a", vendor: activeVendor });
    mocks.createSupabaseServerClient.mockResolvedValue(db);

    const vendor = await getMyVendor();

    expect(vendor?.id).toBe("vendor-a");
    expect(db.query.eq).toHaveBeenCalledWith("user_id", "user-a");
  });

  it("un vendeur ACTIVE modifie simultanément store_name et description sans toucher aux champs protégés", async () => {
    const updated = {
      ...activeVendor,
      store_name: "Après",
      description: "Nouvelle description",
      updated_at: "2026-09-29T00:01:00.000Z",
    };
    const db = makeDb({ userId: "user-a", vendor: activeVendor, updatedVendor: updated });
    mocks.createSupabaseServerClient.mockResolvedValue(db);

    const result = await updateVendor({ storeName: "Après", description: "Nouvelle description" });

    expect(result.ok).toBe(true);
    expect(db.query.update).toHaveBeenCalledWith({
      store_name: "Après",
      description: "Nouvelle description",
    });
    if (result.ok) {
      expect(result.vendor.slug).toBe("avant");
      expect(result.vendor.commissionRateBps).toBe(1000);
      expect(result.vendor.userId).toBe("user-a");
      expect(result.vendor.updatedAt).toBe("2026-09-29T00:01:00.000Z");
    }
  });

  it.each(["PENDING", "REJECTED", "SUSPENDED"])("refuse une boutique %s", async (status) => {
    const db = makeDb({ userId: "user-a", vendor: { ...activeVendor, status } });
    mocks.createSupabaseServerClient.mockResolvedValue(db);

    const result = await updateVendor({ storeName: "Après", description: null });

    expect(result).toEqual({ ok: false, error: "Seule une boutique ACTIVE peut être modifiée." });
    expect(db.query.update).not.toHaveBeenCalled();
  });

  it("ne peut pas résoudre ou modifier la boutique d'un autre vendeur", async () => {
    const db = makeDb({ userId: "user-a", vendor: { ...activeVendor, user_id: "user-b" } });
    mocks.createSupabaseServerClient.mockResolvedValue(db);

    const result = await updateVendor({ storeName: "Après", description: null });

    expect(result).toEqual({ ok: false, error: "Boutique introuvable ou accès refusé." });
    expect(db.query.update).not.toHaveBeenCalled();
  });
});
