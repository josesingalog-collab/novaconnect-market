import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requiresMfaChallenge } from "@/lib/supabase/mfa";
import { updateProductStatus } from "@/services/products/manage";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const { productId } = await context.params;
  if (!UUID_PATTERN.test(productId)) {
    return NextResponse.json({ error: "Produit introuvable." }, { status: 404 });
  }

  const current = await getCurrentProfile();
  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const supabase = await createSupabaseServerClient();
  if (await requiresMfaChallenge(supabase)) {
    return NextResponse.json({ error: "Vérification en deux étapes requise." }, { status: 403 });
  }

  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (vendor === null) {
    return NextResponse.json({ error: "Boutique introuvable ou non active." }, { status: 403 });
  }

  const result = await updateProductStatus(supabase, productId, vendor.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  revalidatePath("/vendor/catalogue");
  revalidatePath("/catalogue");
  return NextResponse.json({ ok: true });
}
