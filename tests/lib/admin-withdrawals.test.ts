import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRpc = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();
const mockGetCurrentProfile = vi.fn();

const activeAdmin = {
  kind: "ok" as const,
  profile: {
    id: "admin-id",
    email: "admin@example.com",
    fullName: "Admin",
    phone: null,
    avatarUrl: null,
    role: "ADMIN" as const,
    status: "ACTIVE" as const,
    createdAt: "2026-01-01T00:00:00Z",
  },
};

beforeEach(() => {
  vi.resetModules();
  mockRpc.mockReset();
  mockCreateSupabaseServerClient.mockReset();
  mockGetCurrentProfile.mockReset();
  mockGetCurrentProfile.mockResolvedValue(activeAdmin);
  mockCreateSupabaseServerClient.mockResolvedValue({ rpc: mockRpc });
  mockRpc.mockResolvedValue({ error: null });
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: mockCreateSupabaseServerClient,
  }));
  vi.doMock("@/lib/profile", () => ({ getCurrentProfile: mockGetCurrentProfile }));
});

describe("services/admin/withdrawals", () => {
  it.each([
    ["approve", "approve_withdrawal"],
    ["process", "process_withdrawal"],
    ["pay", "mark_withdrawal_paid"],
    ["reject", "reject_withdrawal"],
  ] as const)("appelle %s via %s", async (transition, rpc) => {
    const { transitionAdminWithdrawal } = await import("@/services/admin/withdrawals");
    const withdrawalId = "7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac";

    await transitionAdminWithdrawal(withdrawalId, transition);

    expect(mockRpc).toHaveBeenCalledWith(rpc, { p_withdrawal: withdrawalId });
  });

  it("refuse un identifiant de retrait invalide avant l'appel SQL", async () => {
    const { transitionAdminWithdrawal } = await import("@/services/admin/withdrawals");

    await expect(transitionAdminWithdrawal("invalide", "approve")).rejects.toThrow(
      "Identifiant de retrait invalide",
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuse un utilisateur qui n'est pas un administrateur actif", async () => {
    mockGetCurrentProfile.mockResolvedValue({
      ...activeAdmin,
      profile: { ...activeAdmin.profile, role: "VENDOR" },
    });
    const { transitionAdminWithdrawal } = await import("@/services/admin/withdrawals");

    await expect(
      transitionAdminWithdrawal("7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac", "approve"),
    ).rejects.toThrow("Accès administrateur requis");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("propage l'erreur du RPC", async () => {
    mockRpc.mockResolvedValue({ error: { message: "Transition non autorisee" } });
    const { transitionAdminWithdrawal } = await import("@/services/admin/withdrawals");

    await expect(
      transitionAdminWithdrawal("7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac", "approve"),
    ).rejects.toThrow("Transition non autorisee");
  });
});
