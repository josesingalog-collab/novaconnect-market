/**
 * Lectures PUBLIQUES des boutiques (vendeurs) — RLS : vendeurs ACTIVE only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type PublicVendorsDb = Pick<SupabaseClient, "from">;

export interface ActiveVendor {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  logoUrl: string | null;
}

/** Boutiques à afficher publiquement, les plus récentes d'abord. */
export async function listActiveVendors(db: PublicVendorsDb, limit = 4): Promise<ActiveVendor[]> {
  const { data, error } = await db
    .from("vendors")
    .select("id, store_name, slug, description, logo_url")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error !== null) {
    throw new Error(`Lecture des boutiques impossible : ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    storeName: row.store_name,
    slug: row.slug,
    description: row.description,
    logoUrl: row.logo_url,
  }));
}
