import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCurrentProfile: vi.fn(),
  createSupabaseServerClient: vi.fn(),
  createSupabaseAdminClient: vi.fn(),
  requiresMfaChallenge: vi.fn(),
  getStorageBucketProductFiles: vi.fn(),
}));

vi.mock("@/lib/profile", () => ({ getCurrentProfile: mocks.getCurrentProfile }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: mocks.createSupabaseAdminClient,
}));
vi.mock("@/lib/supabase/mfa", () => ({ requiresMfaChallenge: mocks.requiresMfaChallenge }));
vi.mock("@/lib/env", () => ({
  getStorageBucketProductFiles: mocks.getStorageBucketProductFiles,
}));

import { GET as downloadFile } from "@/app/api/downloads/[orderItemId]/[fileId]/route";
import { DELETE as deleteProductFile } from "@/app/api/products/[productId]/files/[fileId]/route";

const PRODUCT_ID = "123e4567-e89b-12d3-a456-426614174000";
const FILE_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ORDER_ITEM_ID = "b0eecb99-9c0d-4ef8-bb6d-6bb9bd380a11";

function params<T extends Record<string, string>>(values: T): { params: Promise<T> } {
  return { params: Promise.resolve(values) };
}

function request(pathname: string) {
  return new NextRequest(`http://localhost${pathname}`);
}

function maybeSingle(data: unknown) {
  return { maybeSingle: vi.fn().mockResolvedValue({ data }) };
}

describe("Routes de fichiers : validation UUID et autorisations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStorageBucketProductFiles.mockReturnValue("product-files");
    mocks.createSupabaseServerClient.mockResolvedValue({});
    mocks.requiresMfaChallenge.mockResolvedValue(false);
  });

  it("accepte des UUID valides pour la suppression", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      kind: "ok",
      profile: { id: "seller-user", status: "ACTIVE" },
    });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const deleteFile = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const from = vi.fn((table: string) => {
      if (table === "products") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(maybeSingle({ vendor_id: "vendor-a", status: "DRAFT" })),
          }),
        };
      }
      if (table === "vendors") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi
              .fn()
              .mockReturnValue({ eq: vi.fn().mockReturnValue(maybeSingle({ id: "vendor-a" })) }),
          }),
        };
      }
      if (table === "product_files") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi
                .fn()
                .mockReturnValue(maybeSingle({ id: FILE_ID, storage_path: "seller/file.pdf" })),
            }),
          }),
          delete: deleteFile,
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue(maybeSingle(null)) }),
        }),
      };
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from,
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    });

    const response = await deleteProductFile(
      request(`/api/products/${PRODUCT_ID}/files/${FILE_ID}`),
      params({ productId: PRODUCT_ID, fileId: FILE_ID }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(remove).toHaveBeenCalledWith(["seller/file.pdf"]);
  });

  it("rejette un UUID invalide avant tout accès aux services", async () => {
    const response = await deleteProductFile(
      request("/api/products/not-a-uuid/files/not-a-uuid"),
      params({ productId: "not-a-uuid", fileId: "not-a-uuid" }),
    );

    expect(response.status).toBe(404);
    expect(mocks.getCurrentProfile).not.toHaveBeenCalled();
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("interdit la suppression à un autre vendeur", async () => {
    mocks.getCurrentProfile.mockResolvedValue({
      kind: "ok",
      profile: { id: "seller-user-b", status: "ACTIVE" },
    });
    const remove = vi.fn();
    const from = vi.fn((table: string) => {
      if (table === "products") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue(maybeSingle({ vendor_id: "vendor-a", status: "DRAFT" })),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi
            .fn()
            .mockReturnValue({ eq: vi.fn().mockReturnValue(maybeSingle({ id: "vendor-b" })) }),
        }),
      };
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      from,
      storage: { from: vi.fn().mockReturnValue({ remove }) },
    });

    const response = await deleteProductFile(
      request(`/api/products/${PRODUCT_ID}/files/${FILE_ID}`),
      params({ productId: PRODUCT_ID, fileId: FILE_ID }),
    );

    expect(response.status).toBe(403);
    expect(remove).not.toHaveBeenCalled();
  });

  it("autorise le téléchargement quand le grant d'un achat valide est accordé", async () => {
    const createSignedUrl = vi.fn().mockResolvedValue({
      data: { signedUrl: "https://storage.example.test/signed-file" },
      error: null,
    });
    mocks.createSupabaseServerClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { storage_path: "seller/file.pdf", file_name: "file.pdf" },
        error: null,
      }),
    });
    mocks.createSupabaseAdminClient.mockReturnValue({
      storage: { from: vi.fn().mockReturnValue({ createSignedUrl }) },
    });

    const response = await downloadFile(
      request(`/api/downloads/${ORDER_ITEM_ID}/${FILE_ID}`),
      params({ orderItemId: ORDER_ITEM_ID, fileId: FILE_ID }),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://storage.example.test/signed-file");
    expect(createSignedUrl).toHaveBeenCalledWith("seller/file.pdf", 120, { download: "file.pdf" });
  });

  it("rejette un UUID de téléchargement invalide avant le grant", async () => {
    const rpc = vi.fn();
    mocks.createSupabaseServerClient.mockResolvedValue({ rpc });

    const response = await downloadFile(
      request("/api/downloads/not-a-uuid/not-a-uuid"),
      params({ orderItemId: "not-a-uuid", fileId: "not-a-uuid" }),
    );

    expect(response.status).toBe(404);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("interdit le téléchargement sans grant d'autorisation", async () => {
    mocks.createSupabaseServerClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: "non autorisé" } }),
    });

    const response = await downloadFile(
      request(`/api/downloads/${ORDER_ITEM_ID}/${FILE_ID}`),
      params({ orderItemId: ORDER_ITEM_ID, fileId: FILE_ID }),
    );

    expect(response.status).toBe(403);
    expect(mocks.createSupabaseAdminClient).not.toHaveBeenCalled();
  });
});
