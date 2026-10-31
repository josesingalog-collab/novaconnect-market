import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStorageBucketProductFiles } from "@/lib/env";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderItemId: string; fileId: string }> },
): Promise<NextResponse> {
  const { orderItemId, fileId } = await context.params;
  if (!UUID_PATTERN.test(orderItemId) || !UUID_PATTERN.test(fileId)) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: grant, error } = await supabase.rpc("create_download_grant", {
    p_order_item: orderItemId,
    p_product_file: fileId,
  });
  if (error !== null || grant === null) {
    return NextResponse.json({ error: "Téléchargement non autorisé." }, { status: 403 });
  }

  const file = grant as { storage_path: string; file_name: string };
  const admin = createSupabaseAdminClient();
  const { data: signed, error: signedError } = await admin.storage
    .from(getStorageBucketProductFiles())
    .createSignedUrl(file.storage_path, 120, { download: file.file_name });
  if (signedError !== null || signed === null) {
    return NextResponse.json({ error: "Génération du lien impossible." }, { status: 500 });
  }
  return NextResponse.redirect(signed.signedUrl, 302);
}
