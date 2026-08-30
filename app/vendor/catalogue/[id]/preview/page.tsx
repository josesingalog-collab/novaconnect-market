import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { getMyProduct } from "@/services/products/manage";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Brouillon",
  PENDING_REVIEW: "En attente de validation",
  PUBLISHED: "Publié",
  ARCHIVED: "Archivé",
};

export default async function PreviewProductPage({ params }: { params: Promise<{ id: string }> }) {
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

  let thumbnailUrl: string | null = product.thumbnailUrl;
  if (!thumbnailUrl && product.thumbnailPath) {
    try {
      const res = await fetch(`/api/products/${id}/cover`);
      if (res.ok) {
        const data = await res.json();
        thumbnailUrl = data.thumbnailUrl ?? null;
      }
    } catch {
      // fallback
    }
  }

  const canPurchase = product.status === "PUBLISHED";

  return (
    <div className="mx-auto max-w-4xl flex-1 flex flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            NovaConnect Market · Aperçu
          </p>
          <Badge variant={product.status === "PUBLISHED" ? "default" : "secondary"}>
            {STATUS_LABELS[product.status] ?? product.status}
          </Badge>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Aperçu : {product.title}</h1>
        <div className="flex items-center gap-2">
          <Link href={`/vendor/catalogue/${id}/edit`} className="text-sm text-primary hover:underline">
            ← Retour à l&apos;édition
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={product.title} className="h-80 w-full object-cover rounded-lg border" />
          ) : (
            <div className="h-80 w-full rounded-lg border border-dashed border-muted-foreground/30 flex items-center justify-center">
              <span className="text-muted-foreground">Pas d&apos;image de couverture</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{product.title}</h2>
          {product.shortDescription && <p className="text-lg text-muted-foreground">{product.shortDescription}</p>}
          <p className="text-sm text-muted-foreground">{product.description ?? "Aucune description."}</p>

          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-foreground">
              {product.price} {product.currency}
            </span>
          </div>

          <button disabled={!canPurchase} className="w-full rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60">
            {canPurchase ? "Acheter" : "Indisponible — produit non publié"}
          </button>

          {!canPurchase && (
            <p className="text-xs text-muted-foreground text-center">
              Le bouton d&apos;achat est désactivé tant que le produit n&apos;est pas publié.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}