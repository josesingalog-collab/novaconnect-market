import Link from "next/link";
import { ProductCard } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPublicProducts, type PublicProductPage } from "@/services/products/public";

export const metadata = {
  title: "NovaConnect Market | Votre vitrine numérique",
  description:
    "Créez votre boutique, publiez vos ressources numériques et découvrez les créations de la communauté NovaConnect.",
  robots: { index: true, follow: true },
};

const steps = [
  ["01", "Créez votre vitrine", "Choisissez le nom de votre boutique et donnez-lui une identité."],
  [
    "02",
    "Ajoutez vos ressources",
    "Préparez vos produits numériques, leurs visuels et leurs fichiers.",
  ],
  [
    "03",
    "Partagez votre lien",
    "Faites découvrir votre travail depuis une page qui vous ressemble.",
  ],
] as const;

const faqs = [
  [
    "Ma boutique est-elle visible dès sa création ?",
    "Oui. Après sa création, votre boutique dispose de sa propre page publique que vous pouvez commencer à partager.",
  ],
  [
    "Combien de fichiers puis-je ajouter à un produit ?",
    "Vous pouvez associer jusqu'à trois fichiers à un même produit numérique.",
  ],
  [
    "Puis-je modifier un produit publié ?",
    "Vous pouvez mettre à jour les informations et les fichiers de votre produit avant sa première vente.",
  ],
  [
    "À qui s'adresse NovaConnect ?",
    "Aux créateurs qui souhaitent organiser et présenter des guides, templates, formations et autres ressources numériques.",
  ],
] as const;

export default async function HomePage() {
  let featuredProducts: PublicProductPage | null = null;

  try {
    const db = await createSupabaseServerClient();
    featuredProducts = await listPublicProducts(db, { sort: "recent" });
  } catch {
    // Les produits mis en avant sont optionnels : la landing doit rester disponible
    // même lorsqu'une requête vers le catalogue ne peut pas aboutir.
  }

  return (
    <main className="flex-1 overflow-hidden bg-[#f8fbff]">
      <section className="relative isolate border-b border-primary/10 bg-[linear-gradient(to_right,rgba(37,99,235,0.055)_1px,transparent_1px),linear-gradient(to_bottom,rgba(37,99,235,0.055)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white/30 via-[#f8fbff]/75 to-[#f8fbff]" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-white/85 px-3 py-1.5 text-xs font-semibold tracking-[0.13em] text-primary uppercase shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-sky" />
            L&apos;espace des créateurs numériques
          </p>
          <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-bold tracking-[-0.06em] text-foreground sm:text-6xl lg:text-7xl lg:leading-[1.03]">
            Donnez une place à vos idées.{" "}
            <span className="text-primary">Partagez ce que vous créez.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground sm:text-lg">
            La plateforme pour créer votre boutique, organiser vos ressources numériques et les
            présenter dans un espace à votre image.
          </p>
          <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-h-12 px-7 shadow-lg shadow-primary/20">
              <Link href="/dashboard/devenir-vendeur">Créer ma boutique</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-12 border-primary/20 bg-white/85 px-7 text-primary hover:bg-primary/5"
            >
              <Link href="#avantages">Découvrir NovaConnect</Link>
            </Button>
          </div>
          <p className="mt-5 text-sm text-muted-foreground">
            Votre vitrine, vos ressources, votre rythme.
          </p>
        </div>

        <div className="mx-auto mt-14 w-full max-w-5xl overflow-hidden rounded-t-[1.75rem] border border-border bg-white shadow-[0_-8px_50px_rgba(37,99,235,0.13)] sm:mt-16">
          <div className="flex items-center justify-between border-b border-border bg-muted/65 px-3 py-2.5 sm:px-5">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-primary/25" />
              <span className="h-2 w-2 rounded-full bg-primary/20" />
              <span className="h-2 w-2 rounded-full bg-primary/15" />
            </div>
            <div className="rounded-md border border-border bg-white px-3 py-1 text-[10px] font-medium text-muted-foreground">
              novaconnect.market/espace-vendeur
            </div>
            <span className="w-8" aria-hidden="true" />
          </div>
          <div className="grid min-h-70 grid-cols-[3.8rem_1fr] sm:min-h-88 sm:grid-cols-[10.5rem_1fr]">
            <aside className="bg-[#102b61] px-2 py-4 text-white sm:px-4 sm:py-5">
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky text-[9px] font-bold text-primary">
                  NC
                </span>
                <span className="hidden text-sm font-bold sm:inline">NovaConnect</span>
              </div>
              <div className="mt-5 space-y-2 text-[10px] sm:text-xs">
                {["Vue d'ensemble", "Mes produits", "Ma boutique", "Commandes"].map(
                  (item, index) => (
                    <div
                      key={item}
                      className={`rounded-lg px-2 py-2 ${index === 0 ? "bg-white/13 text-white" : "text-white/55"}`}
                    >
                      <span className="hidden sm:inline">{item}</span>
                      <span className="sm:hidden">{index + 1}</span>
                    </div>
                  ),
                )}
              </div>
            </aside>
            <div className="min-w-0 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.12em] text-primary uppercase">
                    Espace vendeur
                  </p>
                  <h2 className="mt-1 text-base font-bold text-foreground sm:text-xl">
                    Bonjour, créateur.
                  </h2>
                </div>
                <span className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-white sm:px-3">
                  Nouveau produit
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Votre boutique", "Prête à partager"],
                  ["Produits", "Organisez vos ressources"],
                  ["Fichiers", "Jusqu'à 3 par produit"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-xl border border-border bg-[#f8fbff] p-3">
                    <p className="text-[11px] font-bold text-foreground">{title}</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{text}</p>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl border border-border p-3 sm:p-4">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-foreground">Vos ressources</p>
                  <span className="text-[10px] font-medium text-primary">Voir le catalogue</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {["Guide", "Template", "Formation"].map((item, index) => (
                    <div
                      key={item}
                      className="overflow-hidden rounded-lg border border-border bg-white"
                    >
                      <div
                        className={`h-7 sm:h-10 ${index === 0 ? "bg-sky/30" : index === 1 ? "bg-primary/15" : "bg-blue-100"}`}
                      />
                      <p className="truncate px-1.5 py-1 text-[9px] font-medium text-foreground">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-white px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl divide-y divide-border md:grid-cols-4 md:divide-x md:divide-y-0">
          {[
            ["Boutique personnelle", "Votre page publique"],
            ["Produits numériques", "Guides, templates et plus"],
            ["Jusqu'à 3 fichiers", "Pour chaque produit"],
            ["Espace vendeur", "Produits et commandes"],
          ].map(([title, description]) => (
            <div key={title} className="px-2 py-5 text-center sm:px-5 md:py-6">
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section
        id="avantages"
        className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
            Pensé pour mettre votre travail en valeur
          </p>
          <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
            Plus qu&apos;un lien : un espace qui porte votre signature.
          </h2>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          <article className="relative overflow-hidden rounded-3xl bg-[#102b61] p-7 text-white sm:p-9 lg:col-span-7">
            <div className="absolute -top-16 -right-12 h-48 w-48 rounded-full bg-sky/25 blur-2xl" />
            <p className="relative text-xs font-semibold tracking-[0.15em] text-sky uppercase">
              Une vitrine qui vous ressemble
            </p>
            <h3 className="relative mt-4 max-w-md text-2xl font-bold tracking-tight sm:text-3xl">
              Présentez votre savoir-faire avec simplicité.
            </h3>
            <p className="relative mt-4 max-w-lg text-sm leading-7 text-white/70 sm:text-base">
              Votre nom, votre description et vos créations sont réunis dans une boutique publique
              facile à parcourir.
            </p>
            <div className="relative mt-9 flex max-w-sm items-center gap-3 rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-sm font-bold">
                AN
              </span>
              <div>
                <p className="text-sm font-semibold">Atelier Nova</p>
                <p className="text-xs text-white/55">Créations numériques</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-white p-7 sm:p-9 lg:col-span-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky/20 text-primary">
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
                  strokeWidth={1.8}
                  d="M12 4.75v14.5m7.25-7.25H4.75"
                />
              </svg>
            </div>
            <h3 className="mt-8 text-xl font-bold tracking-tight text-foreground">
              Vos ressources, bien organisées.
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Ajoutez une couverture, une description et les fichiers associés afin que chaque
              produit soit clair dès le premier regard.
            </p>
            <div className="mt-7 space-y-2">
              {["Couverture de produit", "Description détaillée", "Fichiers associés"].map(
                (item) => (
                  <p
                    key={item}
                    className="flex items-center gap-2 text-sm font-medium text-foreground"
                  >
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-success/10 text-success">
                      ✓
                    </span>
                    {item}
                  </p>
                ),
              )}
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-[#edf6ff] p-7 sm:p-9 lg:col-span-5">
            <p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
              Un parcours direct
            </p>
            <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground">
              Moins de configuration, plus de création.
            </h3>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Passez de votre idée à une page publique sans construire votre propre site.
            </p>
          </article>

          <article className="rounded-3xl border border-border bg-white p-7 sm:p-9 lg:col-span-7">
            <div className="flex flex-col justify-between gap-7 sm:flex-row sm:items-end">
              <div className="max-w-md">
                <p className="text-xs font-semibold tracking-[0.15em] text-primary uppercase">
                  Un espace à suivre
                </p>
                <h3 className="mt-4 text-xl font-bold tracking-tight text-foreground">
                  Gardez la main sur votre catalogue.
                </h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Depuis votre espace vendeur, retrouvez vos produits, vos commandes et
                  l&apos;évolution de votre boutique.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-muted p-3 text-center sm:min-w-52">
                {[
                  ["Produits", "01"],
                  ["Fichiers", "03"],
                  ["Boutique", "✓"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl bg-white px-2 py-3 shadow-sm">
                    <p className="text-lg font-bold text-primary">{value}</p>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="border-y border-border bg-white px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              Votre point de départ
            </p>
            <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
              Une boutique en trois mouvements.
            </h2>
          </div>
          <div className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
            <div className="absolute top-7 right-[17%] left-[17%] hidden h-px bg-border md:block" />
            {steps.map(([number, title, description]) => (
              <article key={number} className="relative text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/15 bg-[#f8fbff] text-sm font-bold text-primary shadow-sm">
                  {number}
                </span>
                <h3 className="mt-6 text-lg font-bold text-foreground">{title}</h3>
                <p className="mx-auto mt-3 max-w-xs text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {featuredProducts !== null && featuredProducts.products.length > 0 && (
        <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div className="max-w-xl">
              <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
                Dans le catalogue
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
                Les dernières ressources publiées.
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Explorez ce que les créateurs de la communauté ont choisi de partager.
              </p>
            </div>
            <Button
              asChild
              variant="outline"
              className="border-primary/20 bg-white text-primary hover:bg-primary/5"
            >
              <Link href="/catalogue">Voir le catalogue</Link>
            </Button>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featuredProducts.products.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-6 sm:pb-28 lg:px-8">
        <div className="overflow-hidden rounded-[2rem] bg-[#102b61] px-6 py-12 text-center text-white sm:px-12 sm:py-16">
          <p className="text-xs font-semibold tracking-[0.16em] text-sky uppercase">
            Votre prochaine étape
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
            Lancez votre vitrine numérique avec NovaConnect.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
            Donnez à vos ressources un espace clair, personnel et prêt à être découvert.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 min-h-12 bg-white px-7 text-primary hover:bg-sky/20"
          >
            <Link href="/dashboard/devenir-vendeur">Créer ma boutique</Link>
          </Button>
        </div>

        <section aria-labelledby="faq-title" className="mx-auto mt-20 max-w-3xl sm:mt-28">
          <div className="text-center">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              Questions fréquentes
            </p>
            <h2
              id="faq-title"
              className="mt-4 text-3xl font-bold tracking-[-0.045em] text-foreground"
            >
              Tout commence simplement.
            </h2>
          </div>
          <div className="mt-10 divide-y divide-border border-y border-border">
            {faqs.map(([question, answer]) => (
              <details key={question} className="group py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-5 text-left text-sm font-bold text-foreground [&::-webkit-details-marker]:hidden">
                  {question}
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-primary transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="max-w-2xl pt-3 pr-10 text-sm leading-7 text-muted-foreground">
                  {answer}
                </p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
