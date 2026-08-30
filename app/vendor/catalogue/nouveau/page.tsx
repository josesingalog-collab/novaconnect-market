import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { listCategories } from "@/services/products/manage";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product-form";

export default async function NewProductPage() {
  const current = await getCurrentProfile();

  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    redirect("/vendor");
  }

  const supabase = await createSupabaseServerClient();
  const categories = await listCategories(supabase);

  return (
    <div className="mx-auto max-w-5xl flex-1 flex flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          NovaConnect Market · Catalogue
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Nouveau produit</h1>
      </div>

      <ProductForm categories={categories} />
    </div>
  );
}