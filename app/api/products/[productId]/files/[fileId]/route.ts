import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageBucketProductFiles } from "@/lib/env";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ productId: string; fileId: string }> },
): Promise<NextResponse> {
  const { productId, fileId } = await context.params;
  if (!UUID_PATTERN.test(productId) || !UUID_PATTERN.test(fileId)) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const current = await getCurrentProfile();
  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (await requiresMfaChallenge(supabase)) {
    return NextResponse.json({ error: "Vérification en deux étapes requise." }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { data: product } = await admin
    .from("products")
    .select("vendor_id, status")
    .eq("id", productId)
    .maybeSingle();
  const { data: vendor } = await admin
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (
    product === null ||
    vendor === null ||
    product.vendor_id !== vendor.id ||
    !["DRAFT", "REJECTED", "PUBLISHED"].includes(product.status)
  ) {
    return NextResponse.json({ error: "Ce fichier ne peut pas être supprimé." }, { status: 403 });
  }

  const { data: file } = await admin
    .from("product_files")
    .select("id, storage_path")
    .eq("id", fileId)
    .eq("product_id", productId)
    .maybeSingle();
  if (file === null) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const { data: sale } = await admin
    .from("order_items")
    .select("id")
    .eq("product_id", productId)
    .limit(1)
    .maybeSingle();
  if (sale !== null) {
    return NextResponse.json(
      { error: "Les fichiers ne peuvent plus être supprimés après une première vente." },
      { status: 403 },
    );
  }

  const { error: storageError } = await admin.storage
    .from(getStorageBucketProductFiles())
    .remove([file.storage_path]);
  if (storageError !== null) {
    return NextResponse.json({ error: "Impossible de supprimer le fichier." }, { status: 500 });
  }

  const { error: deleteError } = await admin.from("product_files").delete().eq("id", fileId);
  if (deleteError !== null) {
    return NextResponse.json(
      { error: "Fichier supprimé du stockage, mais pas de la liste." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
