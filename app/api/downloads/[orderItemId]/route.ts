/**
 * Livraison numérique — GET /api/downloads/[orderItemId].
 *
 * Le bucket `product-files` reste PRIVÉ : aucun client ne peut forger d'URL.
 * Chaîne : session requise → RPC `create_download_grant` (migration 0012 :
 * droit DÉRIVÉ = commande PAID + acheteur auth.uid(), vendeur propriétaire
 * ou admin + journalisation) → signed URL de 120 s maximum forgée côté
 * serveur → redirection. L'URL expirante est le seul artefact exposé.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStorageBucketProductFiles } from "@/lib/env";

export const runtime = "nodejs";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Durée de vie maximale d'une signed URL (règle non négociable n°2). */
const SIGNED_URL_TTL_SECONDS = 120;

function json(status: number, body: Record<string, unknown>): NextResponse {
  return NextResponse.json(body, { status });
}

/** Messages levés par create_download_grant → code HTTP. */
function rpcStatus(message: string): number {
  if (/connexion|profil introuvable/i.test(message)) return 401;
  if (/autoris[ée]/i.test(message)) return 403;
  if (/introuvable|indisponible/i.test(message)) return 404;
  return 500;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ orderItemId: string }> },
): Promise<NextResponse> {
  const { orderItemId } = await context.params;
  if (!UUID_PATTERN.test(orderItemId)) {
    return json(404, { error: "Article introuvable" });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user === null) {
    return json(401, { error: "Connexion requise" });
  }

  const { data: grant, error } = await supabase.rpc("create_download_grant", {
    p_order_item: orderItemId,
  });
  if (error !== null || grant === null) {
    const message = error?.message ?? "";
    return json(error === null ? 404 : rpcStatus(message), {
      error:
        rpcStatus(message) === 403
          ? "Téléchargement non autorisé pour cette commande."
          : "Fichier indisponible.",
    });
  }

  const fileInfo = grant as {
    storage_path: string;
    file_name: string;
    mime_type: string;
  };

  // Signed URL forge avec le service_role — jamais depuis un client tiers.
  const admin = createSupabaseAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(getStorageBucketProductFiles())
    .createSignedUrl(fileInfo.storage_path, SIGNED_URL_TTL_SECONDS, {
      download: fileInfo.file_name,
    });

  if (signError !== null || signed === null) {
    return json(500, { error: "Génération du lien impossible." });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
