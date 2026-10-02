import { type Metadata } from "next";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProductList } from "@/app/admin/components/product-list";

export const metadata: Metadata = {
  title: "Modération — Produits",
  robots: { index: false, follow: false },
};

interface ProductRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  price: string;
  currency: string;
  thumbnailUrl: string | null;
  shortDescription: string | null;
  createdAt: string;
  category: { name: string; slug: string }[] | null;
  vendor: { store_name: string; slug: string }[] | null;
}

export default async function AdminPage() {
  const supabase = await createSupabaseServerClient();

  const { data: rawProducts, error } = await supabase
    .from("products")
    .select(
      `
      id, title, slug, status, price, currency, thumbnail_url, short_description, created_at,
      category:categories (name, slug),
      vendor:vendors (store_name, slug)
    `,
    )
    .eq("status", "PENDING_REVIEW")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Produits à vérifier
        </h1>
        <p className="text-sm text-destructive">Impossible de charger la liste des produits.</p>
      </div>
    );
  }

  const pendingProducts: ProductRow[] = (rawProducts ?? []).map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    status: p.status,
    price: p.price,
    currency: p.currency,
    thumbnailUrl: p.thumbnail_url,
    shortDescription: p.short_description,
    createdAt: p.created_at,
    category: p.category,
    vendor: p.vendor,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Produits à vérifier
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vérifiez les produits envoyés par les vendeurs avant leur publication.
        </p>
      </div>

      <ProductList products={pendingProducts} />
    </div>
  );
}
