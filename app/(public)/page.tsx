import Link from "next/link";
import { CategoryPills } from "@/components/marketplace/category-pills";
import { ProductCard } from "@/components/marketplace/product-card";
import { VendorCard } from "@/components/marketplace/vendor-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPublicCategories, listPublicProducts } from "@/services/products/public";
import { listActiveVendors } from "@/services/vendors/public";

export const metadata = {
  title: "NovaConnect Market — La marketplace des produits numériques",
  description:
    "Créez, vendez et découvrez des produits numériques utiles, pensés pour apprendre, travailler et développer vos projets.",
  robots: { index: true, follow: true },
};

export default async function HomePage() {
  const db = await createSupabaseServerClient();

  const [categories, latest, vendors] = await Promise.all([
    listPublicCategories(db),
    listPublicProducts(db),
    listActiveVendors(db, 4),
  ]);

  const featuredProducts = latest.products.slice(0, 8);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* HERO */}
      <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28 lg:py-32">
        <Badge variant="outline" className="text-xs font-medium">
          La marketplace des produits digitaux
        </Badge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
          Transformez vos connaissances en revenus.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-muted-foreground">
          Créez, vendez et découvrez des produits numériques utiles, pensés pour apprendre,
          travailler et développer vos projets.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/catalogue">
            <Button size="lg" className="min-h-[48px] px-8">
              Découvrir les produits
            </Button>
          </Link>
          <Link href="/dashboard/devenir-vendeur">
            <Button variant="outline" size="lg" className="min-h-[48px] px-8">
              Vendre sur NovaConnect
            </Button>
          </Link>
        </div>
      </section>

      {/* CATÉGORIES */}
      {categories.length > 0 && (
        <section id="categories" className="scroll-mt-20 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Découvrez ce qui peut vous aider
            </h2>
            <p className="max-w-lg text-base text-muted-foreground">
              Explorez des ressources numériques créées pour apprendre, travailler et développer vos
              projets.
            </p>
          </div>
          <div className="mt-8">
            <CategoryPills categories={categories} />
          </div>
        </section>
      )}

      {/* PRODUITS */}
      <section id="produits" className="scroll-mt-20 py-10">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Découvrez nos produits
            </h2>
            <p className="mt-2 text-base text-muted-foreground">Les produits les plus récents.</p>
          </div>
          {featuredProducts.length > 0 && (
            <Link
              href="/catalogue"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Voir tout →
            </Link>
          )}
        </div>
        {featuredProducts.length > 0 ? (
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
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
            title="Les premiers produits arrivent bientôt"
            description="Découvrez bientôt une sélection de ressources numériques créées par notre communauté."
            action={{ label: "Voir le catalogue", href: "/catalogue" }}
          />
        )}
      </section>

      {/* BOUTIQUES */}
      {vendors.length > 0 && (
        <section id="boutiques" className="scroll-mt-20 py-10">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              Boutiques à la une
            </h2>
            <p className="max-w-lg text-base text-muted-foreground">
              Découvrez les vendeurs les plus actifs sur NovaConnect Market.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {vendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        </section>
      )}

      {/* VALEUR */}
      <section className="scroll-mt-20 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Tout ce qu&apos;il faut pour passer de l&apos;idée à l&apos;action.
          </h2>
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <CardTitle className="mt-4">Apprenez</CardTitle>
              <CardDescription className="mt-1">
                Découvrez des ressources utiles pour développer vos compétences.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue/10 text-blue">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M11 4a2 2 0 114 0v1a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-1a2 2 0 100 4h1a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-1a2 2 0 10-4 0v1a1 1 0 01-1 1H7a1 1 0 01-1-1v-3a1 1 0 00-1-1H4a2 2 0 110-4h1a1 1 0 001-1V7a1 1 0 011-1h3a1 1 0 001-1V4z"
                  />
                </svg>
              </div>
              <CardTitle className="mt-4">Créez</CardTitle>
              <CardDescription className="mt-1">
                Transformez vos connaissances et vos ressources en produits numériques.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <CardTitle className="mt-4">Vendez</CardTitle>
              <CardDescription className="mt-1">
                Présentez vos créations à des personnes qui recherchent des ressources utiles.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky/10 text-sky">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2m0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
              </div>
              <CardTitle className="mt-4">Développez-vous</CardTitle>
              <CardDescription className="mt-1">
                Suivez votre activité depuis votre espace NovaConnect.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="scroll-mt-20 py-16">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Comment fonctionne NovaConnect ?
          </h2>
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              <Badge variant="default" className="mb-2">
                Acheteur
              </Badge>
            </h3>
            <ul className="mt-4 flex flex-col gap-4">
              <li className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  1
                </span>
                <div>
                  <p className="font-medium text-foreground">Trouvez</p>
                  <p className="text-sm text-muted-foreground">
                    Découvrez le produit dont vous avez besoin.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  2
                </span>
                <div>
                  <p className="font-medium text-foreground">Achetez</p>
                  <p className="text-sm text-muted-foreground">Passez votre commande simplement.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                  aria-hidden="true"
                >
                  3
                </span>
                <div>
                  <p className="font-medium text-foreground">Téléchargez</p>
                  <p className="text-sm text-muted-foreground">
                    Retrouvez votre produit après votre achat.
                  </p>
                </div>
              </li>
            </ul>
          </div>
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-xl font-semibold tracking-tight text-foreground">
              <Badge variant="outline" className="mb-2 border-accent text-accent">
                Vendeur
              </Badge>
            </h3>
            <ul className="mt-4 flex flex-col gap-4">
              <li className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
                  aria-hidden="true"
                >
                  1
                </span>
                <div>
                  <p className="font-medium text-foreground">Créez</p>
                  <p className="text-sm text-muted-foreground">Ajoutez votre produit.</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
                  aria-hidden="true"
                >
                  2
                </span>
                <div>
                  <p className="font-medium text-foreground">Faites vérifier</p>
                  <p className="text-sm text-muted-foreground">
                    Soumettez-le à notre processus de vérification.
                  </p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground"
                  aria-hidden="true"
                >
                  3
                </span>
                <div>
                  <p className="font-medium text-foreground">Vendez</p>
                  <p className="text-sm text-muted-foreground">
                    Une fois approuvé, votre produit peut être découvert par les acheteurs.
                  </p>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA VENDEUR */}
      <section id="devenir-vendeur" className="scroll-mt-20 py-16">
        <div className="rounded-2xl bg-primary px-6 py-12 text-center sm:px-12 lg:px-16">
          <h2 className="text-3xl font-semibold tracking-tight text-primary-foreground sm:text-4xl">
            Vous avez quelque chose à transmettre ?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-8 text-primary-foreground/80">
            Transformez votre expertise, vos formations ou vos ressources en produits numériques.
          </p>
          <Link href="/dashboard/devenir-vendeur" className="mt-8 inline-block">
            <Button size="lg" variant="accent" className="min-h-[48px] px-8">
              Commencer à vendre
            </Button>
          </Link>
        </div>
      </section>
    </main>
  );
}
