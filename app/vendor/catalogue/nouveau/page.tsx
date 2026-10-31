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
    <div className="mx-auto flex max-w-6xl flex-1 flex-col px-4 py-6 lg:px-6 lg:py-10">
      <ProductForm categories={categories} />
    </div>
  );
}
