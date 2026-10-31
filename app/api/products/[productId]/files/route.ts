/**
 * Upload de fichier produit — POST /api/products/[productId]/files.
 *
 * Le bucket `product-files` reste PRIVÉ : l'upload passe par le
 * client authentifié (RLS storage + RLS product_files).
 * Le chemin est généré entièrement côté serveur :
 *   {user_id}/products/{product_id}/{uuid}.{ext}
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/profile";
import { uploadProductFile } from "@/services/products/product-files";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";

export const runtime = "nodejs";

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const { productId } = await context.params;

  const profile = await getCurrentProfile();
  if (profile.kind !== "ok" || profile.profile.status !== "ACTIVE") {
    return json(401, { error: "Connexion requise" });
  }

  const supabase = await createSupabaseServerClient();
  if (await requiresMfaChallenge(supabase)) {
    return json(403, { error: "Vérification en deux étapes requise." });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", profile.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();

  if (vendor === null) {
    return json(403, { error: "Boutique introuvable ou non active." });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return json(400, { error: "Fichier requis." });
  }

  const result = await uploadProductFile(
    createSupabaseAdminClient(),
    profile.profile.id,
    productId,
    file,
  );

  if (!result.ok) {
    return json(400, { error: result.error });
  }

  return json(201, {
    ok: true,
    productFile: {
      id: result.productFile.id,
      storage_path: result.productFile.storage_path,
      file_name: result.productFile.file_name,
      version: result.productFile.version,
    },
  });
}
