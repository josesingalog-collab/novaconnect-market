import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { listCategories } from "@/services/products/manage";
import { redirect } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";

export default async function NewProductPage() {
  const current = await getCurrentProfile();

  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    redirect("/vendor");
  }

  const supabase = await createSupabaseServerClient();
  const categories = await listCategories(supabase);

  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <Breadcrumb
        items={[
          { label: "Tableau de bord", href: "/vendor" },
          { label: "Catalogue", href: "/vendor/catalogue" },
          { label: "Créer un produit" },
        ]}
      />

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          NovaConnect Market · Catalogue
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Créer un produit</h1>
        <p className="text-sm text-muted-foreground">
          Ajoutez les informations essentielles de votre produit. Vous pourrez compléter le reste
          ensuite.
        </p>
      </div>

      <ProductForm categories={categories} />
    </div>
  );
}
