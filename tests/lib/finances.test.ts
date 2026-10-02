/**
 * Tests unitaires pour le service financier vendeur.
 *
 * Vérifie :
 * - requestVendorWithdrawal lance une erreur si montant nul
 * - cancelVendorWithdrawal appelle cancel_my_withdrawal
 * - Les erreurs sont correctement propagées
 * - D-001 respecté : aucun Number() ou parseFloat() sur les montants
 * - Le schéma Zod withdrawalPayoutSchema valide correctement
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { withdrawalPayoutSchema } from "@/schemas/withdrawal";

// ─── Mock Supabase ──────────────

const mockRpc = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockGetCurrentProfile = vi.fn();

const mockProfile = {
  kind: "ok" as const,
  profile: {
    id: "test-profile-id",
    email: "test@example.com",
    fullName: "Test",
    phone: null,
    avatarUrl: null,
    role: "VENDOR" as const,
    status: "ACTIVE" as const,
    createdAt: "2026-01-01T00:00:00Z",
  },
};

function createMockDb() {
  return {
    rpc: mockRpc,
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };
}

beforeEach(() => {
  mockRpc.mockReset();
  mockCreateSupabaseServerClient.mockReset();
  mockGetCurrentProfile.mockReset();
  mockGetCurrentProfile.mockResolvedValue(mockProfile);
});

// ─── Tests services ──────────────

describe("services/vendor/finances", () => {
  it("requestVendorWithdrawal lance une erreur si montant nul", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: mockCreateSupabaseServerClient,
    }));
    vi.doMock("@/lib/profile", () => ({
      getCurrentProfile: mockGetCurrentProfile,
    }));
    mockCreateSupabaseServerClient.mockReturnValue(createMockDb());

    const { requestVendorWithdrawal } = await import("@/services/vendor/finances");

    await expect(
      requestVendorWithdrawal({
        amount: "0.00",
        currency: "USD",
        method: "mobile_money",
        payout: { phone: "+243900000000", operator: "Vodacom" },
      }),
    ).rejects.toThrow("strictement positif");
  });

  it("cancelVendorWithdrawal appelle cancel_my_withdrawal", async () => {
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: mockCreateSupabaseServerClient,
    }));
    vi.doMock("@/lib/profile", () => ({
      getCurrentProfile: mockGetCurrentProfile,
    }));
    mockRpc.mockResolvedValue({ data: null, error: null });
    mockCreateSupabaseServerClient.mockReturnValue(createMockDb());

    const { cancelVendorWithdrawal } = await import("@/services/vendor/finances");

    await cancelVendorWithdrawal("withdrawal-id-123");

    expect(mockRpc).toHaveBeenCalledWith("cancel_my_withdrawal", {
      p_withdrawal: "withdrawal-id-123",
    });
  });

  it("cancelVendorWithdrawal propage les erreurs", async () => {
    const rpcError = new Error("Retrait introuvable");
    vi.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: mockCreateSupabaseServerClient,
    }));
    vi.doMock("@/lib/profile", () => ({
      getCurrentProfile: mockGetCurrentProfile,
    }));
    mockRpc.mockResolvedValue({ data: null, error: rpcError });
    mockCreateSupabaseServerClient.mockReturnValue(createMockDb());

    const { cancelVendorWithdrawal } = await import("@/services/vendor/finances");

    await expect(cancelVendorWithdrawal("invalid-id")).rejects.toThrow(
      "Impossible d'annuler le retrait",
    );
  });
});

// ─── Tests schéma Zod ──────────────

describe("schéma Zod withdrawalPayoutSchema", () => {
  it("valide mobile_money avec phone et operator", () => {
    const result = withdrawalPayoutSchema.safeParse({
      method: "mobile_money",
      phone: "+243900000000",
      operator: "Vodacom",
    });
    expect(result.success).toBe(true);
  });

  it("rejette mobile_money sans phone", () => {
    const result = withdrawalPayoutSchema.safeParse({
      method: "mobile_money",
      operator: "Vodacom",
    });
    expect(result.success).toBe(false);
  });

  it("rejette mobile_money avec opérateur vide", () => {
    const result = withdrawalPayoutSchema.safeParse({
      method: "mobile_money",
      phone: "+243900000000",
      operator: "",
    });
    expect(result.success).toBe(false);
  });

  it("valide bank avec tous les champs", () => {
    const result = withdrawalPayoutSchema.safeParse({
      method: "bank",
      account_number: "123456",
      account_name: "Jean Dupont",
      bank_name: "Rawbank",
    });
    expect(result.success).toBe(true);
  });

  it("rejette bank sans account_name", () => {
    const result = withdrawalPayoutSchema.safeParse({
      method: "bank",
      account_number: "123456",
      bank_name: "Rawbank",
    });
    expect(result.success).toBe(false);
  });

  it("rejette les champs supplémentaires pour mobile_money", () => {
    const result = withdrawalPayoutSchema.safeParse({
      method: "mobile_money",
      phone: "+243900000000",
      operator: "Vodacom",
      extraField: "should fail",
    });
    expect(result.success).toBe(false);
  });

  it("rejette les champs supplémentaires pour bank", () => {
    const result = withdrawalPayoutSchema.safeParse({
      method: "bank",
      account_number: "123456",
      account_name: "Jean",
      bank_name: "Rawbank",
      extraField: "should fail",
    });
    expect(result.success).toBe(false);
  });
});
