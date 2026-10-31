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

describe("services/admin/vendors", () => {
  it.each([
    ["approve", "ACTIVE"],
    ["reject", "REJECTED"],
    ["suspend", "SUSPENDED"],
    ["reactivate", "ACTIVE"],
  ] as const)("envoie la transition %s vers %s", async (transition, target) => {
    const { transitionAdminVendor } = await import("@/services/admin/vendors");
    const vendorId = "7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac";

    await transitionAdminVendor(vendorId, transition);

    expect(mockRpc).toHaveBeenCalledWith("admin_transition_vendor", {
      p_vendor: vendorId,
      p_target: target,
    });
  });

  it("refuse un identifiant de boutique invalide avant l'appel SQL", async () => {
    const { transitionAdminVendor } = await import("@/services/admin/vendors");

    await expect(transitionAdminVendor("invalide", "approve")).rejects.toThrow(
      "Identifiant de boutique invalide",
    );
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("refuse un utilisateur qui n'est pas un administrateur actif", async () => {
    mockGetCurrentProfile.mockResolvedValue({
      ...activeAdmin,
      profile: { ...activeAdmin.profile, role: "VENDOR" },
    });
    const { transitionAdminVendor } = await import("@/services/admin/vendors");

    await expect(
      transitionAdminVendor("7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac", "approve"),
    ).rejects.toThrow("Accès administrateur requis");
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("propage l'erreur du RPC", async () => {
    mockRpc.mockResolvedValue({ error: { message: "Transition non autorisee" } });
    const { transitionAdminVendor } = await import("@/services/admin/vendors");

    await expect(
      transitionAdminVendor("7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac", "approve"),
    ).rejects.toThrow("Transition non autorisee");
  });
});
