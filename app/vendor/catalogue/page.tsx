import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/profile";
import { listMyProducts } from "@/services/products/manage";
import { formatPrice } from "@/components/marketplace/format";
import { redirect } from "next/navigation";
import Link from "next/link";

/* eslint-disable @next/next/no-img-element -- Les couvertures privées utilisent des URLs signées temporaires. */
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { Alert } from "@/components/ui/alert";

const PRODUCT_TYPE_BADGES: Record<
  string,
  { label: string; variant: "secondary" | "warning" | "outline" }
> = {
  SERVICE: { label: "Service", variant: "outline" },
  PHYSICAL: { label: "Physique", variant: "secondary" },
  DIGITAL: { label: "Numérique", variant: "warning" },
};

const PRODUCT_STATUS_BADGES: Record<
  string,
  { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  PENDING_REVIEW: { label: "En cours de vérification", variant: "warning" },
  PUBLISHED: { label: "Publié", variant: "success" },
  REJECTED: { label: "Modifications demandées", variant: "destructive" },
  ARCHIVED: { label: "Archivé", variant: "outline" },
};

const STATUS_FILTERS: readonly { value: string; label: string }[] = [
  { value: "", label: "Tous" },
  { value: "DRAFT", label: "Brouillons" },
  { value: "PENDING_REVIEW", label: "En vérification" },
  { value: "PUBLISHED", label: "Publiés" },
  { value: "REJECTED", label: "Modifications demandées" },
  { value: "ARCHIVED", label: "Archivés" },
];

function parseSearchParams(raw: Record<string, string | string[] | undefined>) {
  const pick = (key: string): string => {
    const value = raw[key];
    return typeof value === "string" && value.trim().length > 0 ? value.trim() : "";
  };
  return { q: pick("q"), status: pick("status") };
}

export default async function CataloguePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const current = await getCurrentProfile();

  if (current.kind !== "ok" || current.profile.status !== "ACTIVE") {
    redirect("/vendor");
  }

  const supabase = await createSupabaseServerClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("id")
    .eq("user_id", current.profile.id)
    .eq("status", "ACTIVE")
    .maybeSingle();
  const allProducts = vendor ? await listMyProducts(supabase, vendor.id) : [];

  const { q, status } = parseSearchParams(searchParams);

  const filtered = allProducts.filter((p) => {
    if (q && !p.title.toLowerCase().includes(q.toLowerCase())) return false;
    if (status && p.status !== status) return false;
    return true;
  });

  const stats = {
    total: allProducts.length,
    draft: allProducts.filter((p) => p.status === "DRAFT").length,
    pending: allProducts.filter((p) => p.status === "PENDING_REVIEW").length,
    published: allProducts.filter((p) => p.status === "PUBLISHED").length,
    rejected: allProducts.filter((p) => p.status === "REJECTED").length,
  };

  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          NovaConnect Market · Catalogue
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Mon catalogue</h1>
        <p className="text-sm text-muted-foreground">
          Retrouvez ici tous vos produits et leur état.
        </p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Button asChild variant="default" size="lg">
          <Link href="/vendor/catalogue/nouveau">Ajouter un produit</Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total" value={stats.total} description="Produits" />
        <StatCard label="Brouillons" value={stats.draft} description="En cours" />
        <StatCard label="Vérification" value={stats.pending} description="En attente" />
        <StatCard label="Publiés" value={stats.published} description="En ligne" />
        <StatCard label="Modifications" value={stats.rejected} description="À corriger" />
      </div>

      <form
        method="get"
        action="/vendor/catalogue"
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Rechercher un produit…"
          aria-label="Rechercher un produit par titre"
          className="border-input min-h-[48px] flex-1 rounded-lg border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        <select
          name="status"
          defaultValue={status}
          aria-label="Filtrer par statut"
          className="border-input min-h-[48px] rounded-lg border bg-background px-3 py-2.5 text-sm outline-none"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" className="min-h-[48px]">
          Filtrer
        </Button>
        {(q || status) && (
          <Link
            href="/vendor/catalogue"
            className="flex min-h-[48px] items-center justify-center text-center text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            Réinitialiser
          </Link>
        )}
      </form>

      {filtered.length === 0 && allProducts.length > 0 ? (
        <EmptyState
          icon={
            <span className="text-3xl" aria-hidden="true">
              🔍
            </span>
          }
          title="Aucun produit trouvé"
          description="Essayez un autre filtre ou modifiez votre recherche."
          action={{ label: "Réinitialiser les filtres", href: "/vendor/catalogue" }}
        />
      ) : allProducts.length === 0 ? (
        <EmptyState
          icon={
            <span className="text-3xl" aria-hidden="true">
              📦
            </span>
          }
          title="Vous n'avez encore aucun produit."
          description="Créez votre premier produit et commencez à construire votre catalogue."
          action={{ label: "Ajouter mon premier produit", href: "/vendor/catalogue/nouveau" }}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {filtered.map((product) => {
            const badge =
              PRODUCT_STATUS_BADGES[product.status as keyof typeof PRODUCT_STATUS_BADGES]! ??
              PRODUCT_STATUS_BADGES.DRAFT;
            return (
              <li key={product.id}>
                <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-shadow hover:shadow-md">
                  <div className="flex aspect-video items-center justify-center overflow-hidden bg-muted text-3xl font-semibold text-muted-foreground">
                    {product.thumbnailUrl ? (
                      <img
                        src={product.thumbnailUrl}
                        alt={product.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      product.title.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold text-foreground">
                        {product.title}
                      </h3>
                      <div className="flex gap-1">
                        <Badge
                          variant={
                            PRODUCT_TYPE_BADGES[product.productType ?? "PHYSICAL"]?.variant ??
                            "secondary"
                          }
                        >
                          {PRODUCT_TYPE_BADGES[product.productType ?? "PHYSICAL"]?.label ??
                            product.productType}
                        </Badge>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">
                        {formatPrice(product.price, product.currency)}
                      </span>
                      {product.categoryName && (
                        <span className="text-xs text-muted-foreground">
                          {product.categoryName}
                        </span>
                      )}
                    </div>
                    {product.status === "PENDING_REVIEW" && (
                      <Alert variant="info" className="mt-1">
                        Votre produit a bien été envoyé. Notre équipe vérifie actuellement les
                        informations avant sa publication.
                      </Alert>
                    )}
                    {product.status === "REJECTED" && product.rejectionReason && (
                      <Alert variant="warning" className="mt-1">
                        <span className="font-semibold">Modifications demandées</span>
                        <p className="mt-1">{product.rejectionReason}</p>
                      </Alert>
                    )}
                  </div>
                  <div className="flex gap-2 border-t border-border p-4 pt-0">
                    {product.status === "DRAFT" && (
                      <Link
                        href={`/vendor/catalogue/${product.id}/edit`}
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Continuer
                      </Link>
                    )}
                    {product.status === "REJECTED" && (
                      <Link
                        href={`/vendor/catalogue/${product.id}/edit`}
                        className="inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                      >
                        Corriger
                      </Link>
                    )}
                    {product.status === "PENDING_REVIEW" && (
                      <Link
                        href={`/vendor/catalogue/${product.id}/preview`}
                        className="border-input inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        Voir
                      </Link>
                    )}
                    {product.status === "PUBLISHED" && (
                      <Link
                        href={`/produit/${encodeURIComponent(product.slug)}`}
                        className="border-input inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        Voir
                      </Link>
                    )}
                    {product.status === "ARCHIVED" && (
                      <Link
                        href={`/vendor/catalogue/${product.id}/edit`}
                        className="border-input inline-flex items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        Voir
                      </Link>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
