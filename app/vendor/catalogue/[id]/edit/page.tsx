import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { listCategories, getMyProduct, type SellerProduct } from "@/services/products/manage";
import { ProductForm } from "@/components/product-form";
import { ProductFileUpload } from "@/components/product-file-upload";
import { CoverImageUpload } from "@/components/cover-image-upload";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente de validation",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
};

const STATUS_VARIANTS: Record<string, "secondary" | "warning" | "default" | "destructive"> = {
  DRAFT: "secondary",
  PENDING_REVIEW: "warning",
  PUBLISHED: "default",
  ARCHIVED: "destructive",
};

function ValidationChecklist({ product }: { product: SellerProduct }) {
  const checks = [
    { label: "Titre", ok: !!product.title && product.title.length >= 3 },
    { label: "Description courte", ok: !!product.shortDescription && product.shortDescription.length > 0 },
    { label: "Description longue", ok: !!product.description && product.description.length >= 20 },
    { label: "Catégorie", ok: !!product.categoryId },
    { label: "Prix", ok: !!product.price && parseFloat(product.price) > 0 },
    { label: "Image de couverture", ok: !!product.thumbnailPath },
    { label: "Fichier numérique", ok: false },
  ];
  const allOk = checks.every((c) => c.ok);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        Checklist de validation
      </h2>
      <div className="flex flex-col gap-2">
        {checks.map((c) => (
          <div key={c.label} className="flex items-center gap-2 text-sm">
            <span className={c.ok ? "text-emerald-600" : "text-muted-foreground"}>{c.ok ? "✓" : "○"}</span>
            <span className={c.ok ? "text-foreground" : "text-muted-foreground"}>{c.label}</span>
          </div>
        ))}
      </div>
      {allOk && (
        <div role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ Tous les champs requis sont remplis. Vous pouvez soumettre à la validation.
        </div>
      )}
    </section>
  );
}

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const current = await getCurrentProfile();

  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    redirect("/vendor");
  }

  const supabase = await createSupabaseServerClient();
  const product = await getMyProduct(supabase, id, current.profile.id);

  if (product === null) {
    notFound();
  }

  const categories = await listCategories(supabase);

  return (
    <div className="mx-auto max-w-5xl flex-1 flex flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            NovaConnect Market · Catalogue
          </p>
          <Badge variant={STATUS_VARIANTS[product.status] ?? "secondary"}>{STATUS_LABELS[product.status] ?? product.status}</Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Modifier : {product.title}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/vendor/catalogue/${id}/preview`} className="text-sm text-primary hover:underline">
            👁 Aperçu public
          </Link>
        </div>
      </div>

      <ProductForm
        initialProduct={{
          id: product.id,
          slug: product.slug,
          title: product.title,
          shortDescription: product.shortDescription ?? "",
          description: product.description ?? "",
          price: product.price,
          currency: product.currency,
          categoryId: product.categoryId,
          thumbnailUrl: product.thumbnailUrl ?? "",
          thumbnailPath: product.thumbnailPath,
        }}
        categories={categories}
      />

      <section className="flex flex-col gap-3">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Image de couverture
        </h2>
        <CoverImageUpload
          productId={product.id}
          currentThumbnailPath={product.thumbnailPath}
          onUploadComplete={() => {}}
          onRemove={() => {}}
        />
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Fichier numérique
        </h2>
        <ProductFileUpload productId={product.id} />
      </section>

      <ValidationChecklist product={product} />
    </div>
  );
}