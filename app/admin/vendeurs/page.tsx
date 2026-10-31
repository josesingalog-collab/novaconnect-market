import { type Metadata } from "next";
import { VendorList, type AdminVendorRecord } from "@/app/admin/components/vendor-list";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Modération vendeurs",
  robots: { index: false, follow: false },
};

export default async function AdminVendorsPage() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("id, store_name, slug, description, status, created_at")
    .order("created_at", { ascending: false });

  if (error !== null) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Modération vendeurs
        </h1>
        <p className="text-sm text-destructive">Impossible de charger les boutiques.</p>
      </div>
    );
  }

  const vendors: AdminVendorRecord[] = (data ?? []).map((vendor) => ({
    id: vendor.id,
    storeName: vendor.store_name,
    slug: vendor.slug,
    description: vendor.description,
    status: vendor.status,
    createdAt: vendor.created_at,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Modération vendeurs
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validez les nouvelles boutiques et gérez les accès vendeur.
        </p>
      </div>

      <VendorList vendors={vendors} />
    </div>
  );
}
