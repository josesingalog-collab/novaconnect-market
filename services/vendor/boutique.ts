import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { VendorUpdateInput } from "@/schemas/vendor-update";

export interface MyVendor {
  readonly id: string;
  readonly userId: string;
  readonly storeName: string;
  readonly slug: string;
  readonly description: string | null;
  readonly status: string;
  readonly logoUrl: string | null;
  readonly payoutPhone: string | null;
  readonly commissionRateBps: number;
  readonly updatedAt: string;
}

export type VendorUpdateResult =
  { readonly ok: true; readonly vendor: MyVendor } | { readonly ok: false; readonly error: string };

function toMyVendor(row: {
  id: string;
  user_id: string;
  store_name: string;
  slug: string;
  description: string | null;
  status: string;
  logo_url: string | null;
  payout_phone: string | null;
  commission_rate_bps: number;
  updated_at: string;
}): MyVendor {
  return {
    id: row.id,
    userId: row.user_id,
    storeName: row.store_name,
    slug: row.slug,
    description: row.description,
    status: row.status,
    logoUrl: row.logo_url,
    payoutPhone: row.payout_phone,
    commissionRateBps: row.commission_rate_bps,
    updatedAt: row.updated_at,
  };
}

/** Résout exclusivement la boutique liée à l'utilisateur authentifié. */
export async function getMyVendor(): Promise<MyVendor | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError !== null || user === null) return null;

  const { data, error } = await supabase
    .from("vendors")
    .select(
      "id, user_id, store_name, slug, description, status, logo_url, payout_phone, commission_rate_bps, updated_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (error !== null) {
    throw new Error(`Lecture de la boutique impossible : ${error.message}`);
  }

  return data === null ? null : toMyVendor(data);
}

/**
 * Met à jour uniquement les champs publics autorisés de la boutique active
 * appartenant à l'utilisateur authentifié.
 */
export async function updateVendor(input: VendorUpdateInput): Promise<VendorUpdateResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError !== null || user === null) {
    return { ok: false, error: "Non authentifié." };
  }

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id, user_id, status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (vendorError !== null) {
    return { ok: false, error: "Lecture de la boutique impossible." };
  }
  if (vendor === null || vendor.user_id !== user.id) {
    return { ok: false, error: "Boutique introuvable ou accès refusé." };
  }
  if (vendor.status !== "ACTIVE") {
    return { ok: false, error: "Seule une boutique ACTIVE peut être modifiée." };
  }

  // Le payload SQL est une allowlist explicite, jamais l'entrée client brute.
  const payload = {
    store_name: input.storeName,
    description: input.description,
  };

  const { data, error } = await supabase
    .from("vendors")
    .update(payload)
    .eq("id", vendor.id)
    .eq("user_id", user.id)
    .eq("status", "ACTIVE")
    .select(
      "id, user_id, store_name, slug, description, status, logo_url, payout_phone, commission_rate_bps, updated_at",
    )
    .maybeSingle();

  if (error !== null) {
    return { ok: false, error: "Impossible de modifier la boutique pour le moment." };
  }
  if (data === null) {
    return { ok: false, error: "Boutique introuvable ou non active." };
  }

  return { ok: true, vendor: toMyVendor(data) };
}
