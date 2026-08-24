import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";
import { formatPrice } from "@/components/marketplace/format";
import { APP_NAME } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getPublicProductBySlug } from "@/services/products/public";

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
    title: product.title,
    description:
      product.shortDescription ??
      `${product.title} — disponible sur ${APP_NAME} chez ${product.storeName}.`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const db = await createSupabaseServerClient();
  const product = await getPublicProductBySlug(db, slug);

  // Non publié, vendeur suspendu ou slug inconnu : la RLS masque → 404.
  if (product === null) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
      <nav aria-label="Fil d'Ariane" className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <Link href="/" className="hover:underline">Accueil</Link>
        <span aria-hidden>/</span>
        <Link href="/catalogue" className="hover:underline">Catalogue</Link>
        {product.categorySlug !== null && product.categoryName !== null && (
          <>
            <span aria-hidden>/</span>
            <Link
              href={`/catalogue?categorie=${encodeURIComponent(product.categorySlug)}`}
              className="hover:underline"
            >
              {product.categoryName}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Visuel */}
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 text-7xl font-semibold text-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-700">
          {product.thumbnailUrl !== null ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externe fournie par le vendeur
            <img
              src={product.thumbnailUrl}
              alt={product.title}
              className="h-full w-full object-cover"
            />
          ) : (
            product.title.charAt(0).toUpperCase()
          )}
        </div>

        {/* Infos */}
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {product.title}
          </h1>

          {product.shortDescription !== null && (
            <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400">
              {product.shortDescription}
            </p>
          )}

          <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
            {formatPrice(product.price, product.currency)}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="text-zinc-500 dark:text-zinc-400">Vendu par</span>
            <Link
              href={`/boutique/${product.storeSlug}`}
              className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
            >
              {product.storeName}
            </Link>
          </div>

          {/* Ajout panier (Phase 6) — quantité unique, re-pricing serveur au checkout */}
          <AddToCartButton
            product={{
              productId: product.id,
              slug: product.slug,
              title: product.title,
              price: product.price,
              currency: product.currency,
              storeName: product.storeName,
              thumbnailUrl: product.thumbnailUrl,
            }}
          />

          <ul className="grid gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            <li>✓ Livraison numérique instantanée après paiement confirmé</li>
            <li>✓ Fichiers sécurisés, téléchargement réservé aux acheteurs</li>
          </ul>
        </div>
      </div>

      {/* Description longue — texte brut échappé par React, jamais de HTML injecté */}
      {product.description !== null && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Description
          </h2>
          <div className="mt-4 max-w-none whitespace-pre-line text-sm leading-7 text-zinc-600 dark:text-zinc-400">
            {product.description}
          </div>
        </section>
      )}
    </main>
  );
}
