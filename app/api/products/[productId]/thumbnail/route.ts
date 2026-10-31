import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStorageBucketProductFiles } from "@/lib/env";

export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 60;

/** Serves a cover only after the public catalogue RLS confirms the product is published. */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ productId: string }> },
): Promise<NextResponse> {
  const { productId } = await context.params;
  if (!UUID_PATTERN.test(productId)) {
    return new NextResponse(null, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: product } = await supabase
    .from("products")
    .select("thumbnail_path")
    .eq("id", productId)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (!product?.thumbnail_path) {
    return new NextResponse(null, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const { data: signed, error } = await admin.storage
    .from(getStorageBucketProductFiles())
    .createSignedUrl(product.thumbnail_path, SIGNED_URL_TTL_SECONDS);
  if (error !== null || signed === null) {
    return new NextResponse(null, { status: 404 });
  }

  return NextResponse.redirect(signed.signedUrl, { status: 307 });
}
