import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicVendorBySlug, listPublicProducts } from "@/services/products/public";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { ProductCard } from "@/components/marketplace/product-card";
import { CataloguePagination } from "@/components/marketplace/pagination";
import { MAX_PAGE_SIZE } from "@/services/products/public";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const vendor = await getPublicVendorBySlug(supabase, slug);

  if (vendor === null) {
    return { title: "Boutique introuvable", robots: { index: false, follow: false } };
  }

  return {
    title: `${vendor.storeName} — NovaConnect Market`,
    description:
      vendor.description ??
      `Découvrez les produits numériques proposés par ${vendor.storeName} sur NovaConnect Market.`,
  };
}

export default async function ShopPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { slug } = await params;
  const supabase = await createSupabaseServerClient();
  const vendor = await getPublicVendorBySlug(supabase, slug);

  if (vendor === null) {
    notFound();
  }

  const rawParams = await searchParams;
  const rawPage = typeof rawParams.page === "string" ? rawParams.page : "1";
  const page = Number.parseInt(rawPage, 10);
  const safePage = Number.isNaN(page) || page < 1 ? 1 : Math.min(page, 1000);

  const { products, total } = await listPublicProducts(supabase, {
    vendorId: vendor.id,
    page: safePage,
  });

  const initials = vendor.storeName
    .split(/\s+/)
    .filter((w) => w.length > 0)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Catalogue", href: "/catalogue" },
          { label: vendor.storeName },
        ]}
      />

      {/* HÉRO BOUTIQUE */}
      <section aria-label="À propos de la boutique">
        <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:gap-8 sm:text-left">
          {/* Avatar */}
          <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
            {vendor.logoUrl !== null ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL fournie par le vendeur
              <img
                src={vendor.logoUrl}
                alt={`Logo de ${vendor.storeName}`}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-muted-foreground">{initials || "NC"}</span>
            )}
          </div>

          {/* Infos */}
          <div className="flex flex-1 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {vendor.storeName}
              </h1>
              <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-3 py-0.5 text-xs font-medium text-success">
                Boutique active
              </span>
            </div>
            {vendor.description !== null ? (
              <p className="text-base leading-8 text-muted-foreground">{vendor.description}</p>
            ) : (
              <p className="text-base leading-8 text-muted-foreground">
                Découvrez les produits numériques proposés par cette boutique.
              </p>
            )}
          </div>
        </div>
      </section>

      {/* RÉASSURANCE */}
      <section aria-label="Informations d'achat">
        <Alert variant="success" title="Achat sécurisé">
          <ul className="grid gap-2 text-sm">
            <li className="flex items-center gap-2">
              <span className="shrink-0 text-success" aria-hidden="true">
                ✓
              </span>
              Produits numériques livrés instantanément après confirmation de commande
            </li>
            <li className="flex items-center gap-2">
              <span className="shrink-0 text-success" aria-hidden="true">
                ✓
              </span>
              Fichiers sécurisés, téléchargement réservé aux acheteurs
            </li>
          </ul>
        </Alert>
      </section>

      {/* PRODUITS */}
      <section aria-label="Les produits de cette boutique" className="scroll-mt-20">
        <div className="mb-8 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Les produits de cette boutique
          </h2>
          <Link
            href="/catalogue"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Voir le catalogue complet →
          </Link>
        </div>

        {products.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
            <div className="mt-10">
              <CataloguePagination
                page={safePage}
                pageSize={MAX_PAGE_SIZE}
                total={total}
                baseHref={`/boutique/${slug}`}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={
              <svg
                className="h-8 w-8 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            }
            title="Cette boutique ne propose pas encore de produits"
            description="Les produits de cette boutique apparaîtront ici lorsqu'ils seront disponibles."
            action={{ label: "Découvrir le catalogue", href: "/catalogue" }}
          />
        )}
      </section>

      {/* CTA retour */}
      <div className="flex justify-center pb-8">
        <Link href="/catalogue">
          <Button variant="outline" size="lg">
            Découvrir tous les produits
          </Button>
        </Link>
      </div>
    </main>
  );
}
