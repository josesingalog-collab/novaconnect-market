import Link from "next/link";
import { CategoryPills } from "@/components/marketplace/category-pills";
import { ProductCard } from "@/components/marketplace/product-card";
import { VendorCard } from "@/components/marketplace/vendor-card";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPublicCategories, listPublicProducts } from "@/services/products/public";
import { listActiveVendors } from "@/services/vendors/public";

const SECTION_TITLE =
  "text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50";

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
      <section className="flex flex-col items-center gap-6 py-20 text-center sm:py-28">
        <p className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          Marketplace SaaS · Produits numériques · Afrique francophone
        </p>
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          {APP_NAME}
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {APP_DESCRIPTION}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href="/catalogue"
            className="rounded-lg bg-zinc-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
          >
            Explorer le catalogue
          </Link>
          <Link
            href="/#devenir-vendeur"
            className="rounded-lg border border-zinc-300 px-6 py-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
          >
            Devenir vendeur
          </Link>
        </div>
      </section>

      {/* CATÉGORIES */}
      {categories.length > 0 && (
        <section id="categories" className="scroll-mt-20 py-10">
          <h2 className={SECTION_TITLE}>Catégories</h2>
          <div className="mt-5">
            <CategoryPills categories={categories} />
          </div>
        </section>
      )}

      {/* NOUVEAUTÉS */}
      <section id="nouveautes" className="scroll-mt-20 py-10">
        <div className="flex items-center justify-between gap-4">
          <h2 className={SECTION_TITLE}>Nouveautés</h2>
          {featuredProducts.length > 0 && (
            <Link href="/catalogue" className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400">
              Tout voir →
            </Link>
          )}
        </div>
        {featuredProducts.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Le catalogue est en préparation — les premiers produits arrivent bientôt.
          </p>
        )}
      </section>

      {/* BOUTIQUES */}
      <section id="boutiques" className="scroll-mt-20 py-10">
        <h2 className={SECTION_TITLE}>Boutiques à la une</h2>
        {vendors.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {vendors.map((vendor) => (
              <VendorCard key={vendor.id} vendor={vendor} />
            ))}
          </div>
        ) : (
          <p className="mt-6 rounded-xl border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            Aucune boutique active pour le moment — soyez le premier vendeur !
          </p>
        )}
      </section>

      {/* DEVENIR VENDEUR */}
      <section id="devenir-vendeur" className="scroll-mt-20 py-14">
        <div className="rounded-2xl bg-zinc-900 px-6 py-12 text-center dark:bg-zinc-900/60 sm:px-12">
          <h2 className="text-2xl font-semibold tracking-tight text-white dark:text-zinc-50">
            Vendez vos produits numériques en RDC et au-delà
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-zinc-300 dark:text-zinc-400">
            Ebooks, formations, templates, musiques… publiez en quelques minutes et touchez
            une audience francophone.
          </p>
          <ul className="mx-auto mt-8 grid max-w-2xl gap-4 text-left sm:grid-cols-3">
            {[
              ["Commission transparente", "10 % uniquement sur les ventes réalisées."],
              ["Paiements mobile money", "M-Pesa, Orange Money, Airtel Money."],
              ["Retraits suivis", "Demande de retrait avec historique complet."],
            ].map(([title, text]) => (
              <li key={title} className="rounded-xl bg-zinc-800/60 p-4 dark:bg-zinc-800/40">
                <p className="text-sm font-semibold text-white dark:text-zinc-100">{title}</p>
                <p className="mt-1 text-xs leading-5 text-zinc-400">{text}</p>
              </li>
            ))}
          </ul>
          <Link
            href="/dashboard/devenir-vendeur"
            className="mt-10 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition-colors hover:bg-zinc-200 dark:bg-zinc-100 dark:hover:bg-zinc-300"
          >
            Créer mon compte vendeur
          </Link>
        </div>
      </section>

      {/* RÉASSURANCE */}
      <section className="border-t border-zinc-200 py-10 dark:border-zinc-800">
        <ul className="grid gap-6 text-center sm:grid-cols-3">
          <li>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Paiement sécurisé</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Fonds libérés au vendeur après confirmation du paiement.
            </p>
          </li>
          <li>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Livraison instantanée</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Accès immédiat aux fichiers dès la confirmation de commande.
            </p>
          </li>
          <li>
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Support local</p>
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Une plateforme pensée pour l&apos;Afrique francophone.
            </p>
          </li>
        </ul>
      </section>
    </main>
  );
}
