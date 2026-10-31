/**
 * Tests unitaires — service notifications (Phase 9 S5+).
 *
 * Vérifie :
 * - listNotifications utilise la RLS (aucun user_id fourni au client),
 *   trie récent → ancien et borne la limite à 50
 * - getUnreadNotificationCount compte uniquement read_at IS NULL
 * - markNotificationRead exige un UUID et n'écrase que read_at
 * - markAllNotificationsRead renvoie le nombre marqué lu
 * - les erreurs SQL sont propagées en messages applicatifs
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentProfile = vi.fn();
const mockCreateSupabaseServerClient = vi.fn();

const buyerProfile = {
  kind: "ok" as const,
  profile: {
    id: "buyer-profile-id",
    email: "buyer@example.com",
    fullName: "Acheteur",
    phone: null,
    avatarUrl: null,
    role: "BUYER" as const,
    status: "ACTIVE" as const,
    createdAt: "2026-01-01T00:00:00Z",
  },
};

beforeEach(() => {
  vi.resetModules();
  mockGetCurrentProfile.mockReset();
  mockCreateSupabaseServerClient.mockReset();
  mockGetCurrentProfile.mockResolvedValue(buyerProfile);
  vi.doMock("@/lib/profile", () => ({ getCurrentProfile: mockGetCurrentProfile }));
  vi.doMock("@/lib/supabase/server", () => ({
    createSupabaseServerClient: mockCreateSupabaseServerClient,
  }));
});

function makeDb() {
  const chain = {
    select: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
  };

  const db = {
    from: vi.fn().mockReturnValue(chain),
  };
  return { db, chain };
}

describe("services/notifications", () => {
  it("listNotifications lit la liste en RLS, triée récent → ancien, limite bornée", async () => {
    const { db, chain } = makeDb();
    mockCreateSupabaseServerClient.mockResolvedValue(db);
    const rows = [
      {
        id: "n-2",
        type: "vendor.sale",
        title: "Nouvelle vente",
        body: "Ebook : votre part 9,00 USD",
        link: "/vendor/finances",
        read_at: "2026-10-01T00:00:00Z",
        created_at: "2026-10-01T00:00:00Z",
      },
    ];
    chain.limit.mockResolvedValue({ data: rows, error: null });

    const { listNotifications } = await import("@/services/notifications/notifications");
    const result = await listNotifications(500);

    expect(mockGetCurrentProfile).toHaveBeenCalled();
    expect(chain.select).toHaveBeenCalledWith("id, type, title, body, link, read_at, created_at");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(50);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "n-2",
      type: "vendor.sale",
      readAt: "2026-10-01T00:00:00Z",
    });
  });

  it("listNotifications refuse un utilisateur non authentifié", async () => {
    mockGetCurrentProfile.mockResolvedValue({ kind: "unauthenticated" });
    const { listNotifications } = await import("@/services/notifications/notifications");

    await expect(listNotifications()).rejects.toThrow("Non authentifié");
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("getUnreadNotificationCount filtre read_at IS NULL", async () => {
    const { db, chain } = makeDb();
    mockCreateSupabaseServerClient.mockResolvedValue(db);
    chain.is.mockResolvedValue({ count: 3, error: null });

    const { getUnreadNotificationCount } = await import("@/services/notifications/notifications");
    const count = await getUnreadNotificationCount();

    expect(count).toBe(3);
    expect(chain.is).toHaveBeenCalledWith("read_at", null);
  });

  it("getUnreadNotificationCount renvoie 0 sans session", async () => {
    mockGetCurrentProfile.mockResolvedValue({ kind: "unauthenticated" });
    const { getUnreadNotificationCount } = await import("@/services/notifications/notifications");

    expect(await getUnreadNotificationCount()).toBe(0);
    expect(mockCreateSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("markNotificationRead exige un UUID et n'écrit que read_at", async () => {
    const { db, chain } = makeDb();
    mockCreateSupabaseServerClient.mockResolvedValue(db);
    chain.eq.mockResolvedValue({ data: null, error: null });

    const { markNotificationRead } = await import("@/services/notifications/notifications");
    const id = "7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac";
    await markNotificationRead(id);

    expect(chain.update).toHaveBeenCalledWith({ read_at: expect.any(String) });
    expect(chain.eq).toHaveBeenCalledWith("id", id);
  });

  it("markNotificationRead refuse un identifiant invalide avant tout SQL", async () => {
    const { db } = makeDb();
    mockCreateSupabaseServerClient.mockResolvedValue(db);
    const { markNotificationRead } = await import("@/services/notifications/notifications");

    await expect(markNotificationRead("invalide")).rejects.toThrow(
      "Identifiant de notification invalide",
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("markNotificationRead refuse sans session", async () => {
    mockGetCurrentProfile.mockResolvedValue({ kind: "unauthenticated" });
    const { markNotificationRead } = await import("@/services/notifications/notifications");

    await expect(
      markNotificationRead("7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac"),
    ).rejects.toThrow("Non authentifié");
  });

  it("markNotificationRead propage l'erreur SQL", async () => {
    const { db, chain } = makeDb();
    mockCreateSupabaseServerClient.mockResolvedValue(db);
    chain.eq.mockResolvedValue({ data: null, error: { message: "Seul read_at peut être modifié" } });

    const { markNotificationRead } = await import("@/services/notifications/notifications");

    await expect(
      markNotificationRead("7a5f098e-8a0e-4d9d-b55f-9fc1c78904ac"),
    ).rejects.toThrow("Seul read_at peut être modifié");
  });

  it("markAllNotificationsRead renvoie le nombre de lignes marquées lues", async () => {
    const { db, chain } = makeDb();
    mockCreateSupabaseServerClient.mockResolvedValue(db);
    chain.select.mockResolvedValue({ data: [{ id: "n-1" }, { id: "n-2" }], error: null });

    const { markAllNotificationsRead } = await import("@/services/notifications/notifications");
    const marked = await markAllNotificationsRead();

    expect(marked).toBe(2);
    expect(chain.is).toHaveBeenCalledWith("read_at", null);
  });
});
