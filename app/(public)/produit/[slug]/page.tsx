import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { PaymentMethodsSoon } from "@/components/marketplace/payment-methods-soon";
import { ProductCard } from "@/components/marketplace/product-card";
import { Badge } from "@/components/ui/badge";
import { formatPrice } from "@/components/marketplace/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicProductBySlug, listPublicProducts } from "@/services/products/public";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const db = await createSupabaseServerClient();
  const product = await getPublicProductBySlug(db, slug);

  if (product === null) {
    return { title: "Produit introuvable", robots: { index: false, follow: false } };
  }

  return {
    title: `${product.title} — SAVPAY`,
    description:
      product.shortDescription ??
      `${product.title} — disponible sur SAVPAY chez ${product.storeName}.`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const db = await createSupabaseServerClient();
  const product = await getPublicProductBySlug(db, slug);

  if (product === null) {
    notFound();
  }

  const similarProducts = product.categoryId
    ? await listPublicProducts(db, { categoryId: product.categoryId })
    : { products: [] };

  const similarProductsFiltered = similarProducts.products
    .filter((p) => p.id !== product.id)
    .slice(0, 4);
  const cartProduct = {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    price: product.price,
    currency: product.currency,
    storeName: product.storeName,
    thumbnailUrl: product.thumbnailUrl,
  };

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-10 pb-24 sm:px-6 lg:py-14">
      {/* BREADCRUMB */}
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Catalogue", href: "/catalogue" },
          ...(product.categorySlug !== null && product.categoryName !== null
            ? [{ label: product.categoryName }]
            : []),
          { label: product.title },
        ]}
      />

      <h1 className="mt-8 text-3xl font-semibold tracking-tight text-foreground lg:hidden">
        {product.title}
      </h1>

      {/* HÉRO PRODUIT */}
      <div className="mt-6 grid grid-cols-1 items-start gap-8 lg:mt-8 lg:grid-cols-[minmax(20rem,0.78fr)_minmax(0,1.22fr)] lg:items-center lg:gap-12">
        {/* Visuel */}
        <div className="mx-auto flex aspect-square w-full max-w-lg rounded-2xl border border-border bg-muted p-3 shadow-sm sm:p-4 lg:mx-0">
          {product.thumbnailUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par le vendeur
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              className="h-full w-full rounded-xl border border-border/70 bg-card object-contain p-1.5"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center rounded-xl border border-border/70 bg-card text-6xl font-semibold text-muted-foreground">
              {product.title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Infos */}
        <div className="flex min-w-0 flex-col gap-5 lg:py-4">
          {product.categoryName !== null && (
            <Badge variant="outline" className="w-fit">
              {product.categoryName}
            </Badge>
          )}

          <h1 className="hidden text-3xl font-semibold tracking-tight text-foreground lg:block lg:text-5xl">
            {product.title}
          </h1>

          {product.shortDescription !== null && (
            <p className="text-justify text-base leading-8 text-muted-foreground">
              {product.shortDescription}
            </p>
          )}

          {/* Vendeur */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Vendu par</span>
            <Link
              href={`/boutique/${product.storeSlug}`}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              {product.storeName}
            </Link>
          </div>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <p className="text-4xl font-bold tracking-tight text-foreground">
              {formatPrice(product.price, product.currency)}
            </p>
            <AddToCartButton product={cartProduct} />
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Paiement sécurisé. Le prix est confirmé avant le paiement.
            </p>
            <PaymentMethodsSoon />
          </section>

          {/* Réassurance */}
          <ul className="grid gap-3 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="text-success" aria-hidden="true">
                ✓
              </span>
              Livraison numérique instantanée après paiement confirmé
            </li>
            <li className="flex items-center gap-2">
              <span className="text-success" aria-hidden="true">
                ✓
              </span>
              Fichiers sécurisés, téléchargement réservé aux acheteurs
            </li>
          </ul>
        </div>
      </div>

      {/* DESCRIPTION */}
      {product.description !== null && (
        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            À propos de ce produit
          </h2>
          <div className="mt-4 max-w-4xl text-justify text-[17px] leading-8 whitespace-pre-line text-foreground">
            {product.description}
          </div>
        </section>
      )}

      {/* PRODUITS SIMILAIRES */}
      {similarProductsFiltered.length > 0 && (
        <section className="mt-16 scroll-mt-20">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">
            Vous pourriez aussi aimer
          </h2>
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {similarProductsFiltered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
      <AddToCartButton product={cartProduct} sticky />
    </main>
  );
}
