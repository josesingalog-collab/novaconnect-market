import Link from "next/link";
import { ProductCard } from "@/components/marketplace/product-card";
import { Button } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { TestimonialCard } from "@/components/ui/testimonial-card";
import { RevenueCalculator } from "@/components/ui/revenue-calculator";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPublicProducts, type PublicProductPage } from "@/services/products/public";
import { DEFAULT_COMMISSION_RATE_BPS } from "@/lib/config";

export const metadata = {
  title: "SAVPAY | Votre vitrine numérique",
  description:
    "Créez votre boutique, publiez vos ressources numériques et découvrez les créations de la communauté SAVPAY.",
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

const features = [
  {
    title: "Boutique personnelle",
    description:
      "Une page publique à votre nom, facile à partager sur vos réseaux, votre site ou par WhatsApp.",
    icon: "store",
  },
  {
    title: "Livraison numérique sécurisée",
    description:
      "Vos fichiers restent privés. Chaque acheteur reçoit un lien de téléchargement unique et temporaire.",
    icon: "shield",
  },
  {
    title: "Tableau de bord vendeur",
    description:
      "Suivez vos produits, vos commandes et vos ventes depuis un espace clair et simple.",
    icon: "chart",
  },
  {
    title: "Retraits transparents",
    description:
      "Votre solde se met à jour à chaque vente. Demandez un retrait dès 20 USD de revenus.",
    icon: "wallet",
  },
  {
    title: "Deux devises prises en charge",
    description:
      "Vendez en dollars américains (USD) ou en francs congolais (CDF), selon votre audience.",
    icon: "globe",
  },
  {
    title: "Compte renforcé",
    description:
      "Activez la vérification en deux étapes pour protéger votre boutique et vos revenus.",
    icon: "lock",
  },
] as const;

const trustStats = [
  ["10 %", "de commission unique par vente"],
  ["200 Mo", "par fichier produit"],
  ["20 USD", "de retrait minimum"],
  ["60 s", "pour un lien de téléchargement sécurisé"],
] as const;

/* Témoignages temporaires : à remplacer par de vrais avis clients après le lancement. */
const testimonials = [
  {
    quote:
      "En une soirée, ma boutique était en ligne avec mes trois premiers guides. Mes clients reçoivent leurs fichiers tout seuls.",
    name: "Divin M.",
    role: "Formateur en gestion de projet",
    initials: "DM",
  },
  {
    quote:
      "Ce que je préfère : je peux suivre mes ventes et demander un retrait sans courir après personne.",
    name: "Sarah K.",
    role: "Graphiste freelance",
    initials: "SK",
  },
  {
    quote:
      "La page boutique fait très pro. Je partage juste mon lien dans ma bio et les ventes suivent.",
    name: "Patrick I.",
    role: "Créateur de templates BIM",
    initials: "PI",
  },
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
    "Combien coûte SAVPAY ?",
    "L'inscription est gratuite. SAVPAY prélève 10 % sur chaque vente réalisée — rien d'autre, aucun abonnement.",
  ],
  [
    "Quand puis-je retirer mes revenus ?",
    "Dès que votre solde atteint 20 USD, vous pouvez demander un retrait depuis votre espace vendeur.",
  ],
  [
    "À qui s'adresse SAVPAY ?",
    "Aux créateurs qui souhaitent organiser et présenter des guides, templates, formations et autres ressources numériques.",
  ],
] as const;

function FeatureIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    store: "M3 9l1.5-4.5A1.5 1.5 0 016 3.5h12a1.5 1.5 0 011.5 1L21 9M3 9h18M3 9v9.5A1.5 1.5 0 004.5 20h15a1.5 1.5 0 001.5-1.5V9m-13 4h8",
    shield: "M12 3.5l7 2.75V11c0 4.5-3 7.75-7 9.5-4-1.75-7-5-7-9.5V6.25L12 3.5zm-2.5 7.75l2 2 3.5-3.75",
    chart: "M4 20V10m5 10V4m5 16v-7m5 7V7",
    wallet: "M3 7.5A1.5 1.5 0 014.5 6h13A1.5 1.5 0 0119 7.5v9a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 013 16.5v-9zm16 3h-4.5a1.5 1.5 0 000 3H19",
    globe: "M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c2.5-2.5 4-5.5 4-9s-1.5-6.5-4-9c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9zM3.5 9h17m-17 6h17",
    lock: "M7.5 10.5V8a4.5 4.5 0 019 0v2.5M6 10.5h12a1 1 0 011 1V19a1 1 0 01-1 1H6a1 1 0 01-1-1v-7.5a1 1 0 011-1z",
    plus: "M12 5v14m-7-7h14",
  };

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-primary">
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={paths[name] ?? paths.store} />
      </svg>
    </div>
  );
}

export default async function HomePage() {
  let featuredProducts: PublicProductPage | null = null;

  try {
    const db = await createSupabaseServerClient();
    featuredProducts = await listPublicProducts(db, { sort: "recent" });
  } catch {
    // Les produits mis en avant sont optionnels : la landing doit rester disponible
    // même lorsqu'une requête vers le catalogue ne peut pas aboutir.
  }

  const commissionPercent = Number(DEFAULT_COMMISSION_RATE_BPS / 100n);

  return (
    <main className="flex-1 overflow-hidden bg-background">
      {/* HERO */}
      <section className="relative isolate border-b border-primary/10 bg-[linear-gradient(to_right,rgba(13,43,91,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(13,43,91,0.06)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] px-4 pt-16 sm:px-6 sm:pt-24 lg:px-8 lg:pt-28">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-card/30 via-background/80 to-background" />
        <div className="mx-auto max-w-4xl text-center">
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-card/85 px-3 py-1.5 text-xs font-semibold tracking-[0.13em] text-primary uppercase shadow-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
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
            <Button asChild size="lg" className="min-h-12 px-7 shadow-lift">
              <Link href="/dashboard/devenir-vendeur">Créer ma boutique</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-12 border-primary/20 bg-card/85 px-7 text-primary hover:bg-primary/5"
            >
              <Link href="#avantages">Découvrir SAVPAY</Link>
            </Button>
          </div>
          <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-muted-foreground sm:text-sm">
            <li className="flex items-center gap-1.5">
              <span className="text-success" aria-hidden="true">✓</span>
              Commission unique de {commissionPercent}&nbsp;%
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-success" aria-hidden="true">✓</span>
              Livraison instantanée des fichiers
            </li>
            <li className="flex items-center gap-1.5">
              <span className="text-success" aria-hidden="true">✓</span>
              Boutique gratuite, sans abonnement
            </li>
          </ul>
        </div>

        {/* CAPTURE — aperçu de l'espace vendeur */}
        <div className="mx-auto mt-14 w-full max-w-5xl overflow-hidden rounded-t-[1.75rem] border border-border bg-card shadow-[0_-8px_50px_rgba(13,43,91,0.18)] sm:mt-16">
          <div className="flex items-center justify-between border-b border-border bg-muted/65 px-3 py-2.5 sm:px-5">
            <div className="flex gap-1.5" aria-hidden="true">
              <span className="h-2 w-2 rounded-full bg-primary/25" />
              <span className="h-2 w-2 rounded-full bg-primary/20" />
              <span className="h-2 w-2 rounded-full bg-primary/15" />
            </div>
            <div className="rounded-md border border-border bg-card px-3 py-1 text-[10px] font-medium text-muted-foreground">
              savpay.market/espace-vendeur
            </div>
            <span className="w-8" aria-hidden="true" />
          </div>
          <div className="grid min-h-70 grid-cols-[3.8rem_1fr] sm:min-h-88 sm:grid-cols-[10.5rem_1fr]">
            <aside className="bg-primary px-2 py-4 text-primary-foreground sm:px-4 sm:py-5">
              <div className="flex items-center gap-2 border-b border-white/10 pb-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/15 text-[9px] font-bold text-primary-foreground">
                  SA
                </span>
                <span className="hidden text-sm font-bold sm:inline">SAVPAY</span>
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
                <span className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground sm:px-3">
                  Nouveau produit
                </span>
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Votre boutique", "Prête à partager"],
                  ["Produits", "Organisez vos ressources"],
                  ["Fichiers", "Jusqu'à 3 par produit"],
                ].map(([title, text]) => (
                  <div key={title} className="rounded-xl border border-border bg-background p-3">
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
                      className="overflow-hidden rounded-lg border border-border bg-card"
                    >
                      <div
                        className={`h-7 sm:h-10 ${index === 0 ? "bg-sky/30" : index === 1 ? "bg-primary/15" : "bg-blue/20"}`}
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

      {/* CHIFFRES DE CONFIANCE */}
      <section className="border-b border-border bg-card px-4 sm:px-6 lg:px-8">
        <div className="mx-auto grid w-full max-w-6xl divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          {trustStats.map(([value, label]) => (
            <div key={value} className="px-2 py-5 text-center sm:px-5 md:py-6">
              <p className="text-xl font-bold text-primary sm:text-2xl">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AVANTAGES */}
      <section
        id="avantages"
        className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <SectionHeading
          eyebrow="Pensé pour mettre votre travail en valeur"
          title="Plus qu'un lien : un espace qui porte votre signature."
        />
        <div className="mt-12 grid gap-5 lg:grid-cols-12">
          <article className="relative overflow-hidden rounded-3xl bg-primary p-7 text-primary-foreground shadow-soft sm:p-9 lg:col-span-7">
            <div className="absolute -top-16 -right-12 h-48 w-48 rounded-full bg-blue/30 blur-2xl" />
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
                AK
              </span>
              <div>
                <p className="text-sm font-semibold">Atelier Kasa</p>
                <p className="text-xs text-white/55">Créations numériques</p>
              </div>
            </div>
          </article>

          <article className="rounded-3xl border border-border bg-card p-7 shadow-soft sm:p-9 lg:col-span-5">
            <FeatureIcon name="plus" />
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

          <article className="rounded-3xl border border-border bg-secondary p-7 sm:p-9 lg:col-span-5">
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

          <article className="rounded-3xl border border-border bg-card p-7 shadow-soft sm:p-9 lg:col-span-7">
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
                  <div key={label} className="rounded-xl bg-card px-2 py-3 shadow-sm">
                    <p className="text-lg font-bold text-primary">{value}</p>
                    <p className="mt-1 text-[10px] font-medium text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </article>
        </div>
      </section>

      {/* COMMENT ÇA MARCHE */}
      <section className="border-y border-border bg-card px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeading
            align="center"
            eyebrow="Votre point de départ"
            title="Une boutique en trois mouvements."
          />
          <div className="relative mt-14 grid gap-8 md:grid-cols-3 md:gap-10">
            <div className="absolute top-7 right-[17%] left-[17%] hidden h-px bg-border md:block" />
            {steps.map(([number, title, description]) => (
              <article key={number} className="relative text-center">
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-background text-sm font-bold text-primary shadow-sm">
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

      {/* FONCTIONNALITÉS */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <SectionHeading
          eyebrow="Tout ce qu'il faut pour vendre"
          title="Les outils essentiels, réunis au même endroit."
          lead="Chaque fonctionnalité est pensée pour les créateurs : simple au quotidien, solide sur la sécurité."
        />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-2xl border border-border bg-card p-6 shadow-soft transition-shadow hover:shadow-lift"
            >
              <FeatureIcon name={feature.icon} />
              <h3 className="mt-5 text-base font-bold text-foreground">{feature.title}</h3>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                {feature.description}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* CATALOGUE EN AVANT */}
      {featuredProducts !== null && featuredProducts.products.length > 0 && (
        <section className="border-y border-border bg-card px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
          <div className="mx-auto w-full max-w-6xl">
            <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
              <div className="max-w-xl">
                <SectionHeading
                  eyebrow="Dans le catalogue"
                  title="Les dernières ressources publiées."
                  lead="Explorez ce que les créateurs de la communauté ont choisi de partager."
                />
              </div>
              <Button
                asChild
                variant="outline"
                className="border-primary/20 bg-card text-primary hover:bg-primary/5"
              >
                <Link href="/catalogue">Voir le catalogue</Link>
              </Button>
            </div>
            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {featuredProducts.products.slice(0, 4).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TÉMOIGNAGES */}
      <section className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <SectionHeading
          align="center"
          eyebrow="Ils créent avec SAVPAY"
          title="Des créateurs, des boutiques, des ventes."
        />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <TestimonialCard key={testimonial.name} {...testimonial} />
          ))}
        </div>
      </section>

      {/* TARIFICATION */}
      <section
        id="tarification"
        className="border-y border-border bg-card px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
      >
        <div className="mx-auto w-full max-w-6xl">
          <SectionHeading
            align="center"
            eyebrow="Tarification"
            title="Une commission simple et transparente."
            lead="Pas d'abonnement, pas de frais cachés. SAVPAY ne prélève que lors de vos ventes."
          />
          <div className="mt-12 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="rounded-3xl border border-primary/20 bg-primary px-7 py-10 text-primary-foreground shadow-lift sm:px-9">
              <p className="text-xs font-semibold tracking-[0.16em] text-sky uppercase">
                SAVPAY
              </p>
              <p className="mt-6 flex items-baseline gap-2">
                <span className="text-6xl font-bold tracking-[-0.04em] sm:text-7xl">
                  {commissionPercent}&nbsp;%
                </span>
                <span className="text-sm text-white/70">par vente</span>
              </p>
              <p className="mt-3 text-sm text-white/70">
                Vous gardez {100 - commissionPercent}&nbsp;% de chaque vente.
              </p>
              <ul className="mt-8 space-y-3 text-sm">
                {[
                  "Inscription gratuite, aucune carte requise",
                  "Retraits à partir de 20 USD de revenus",
                  "Vendez en USD ou en CDF",
                  "Fichiers jusqu'à 200 Mo par produit",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">
                      ✓
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                asChild
                size="lg"
                className="mt-9 min-h-12 w-full bg-white px-7 text-foreground hover:bg-secondary"
              >
                <Link href="/dashboard/devenir-vendeur">Créer ma boutique</Link>
              </Button>
            </div>
            <RevenueCalculator commissionPercent={commissionPercent} />
          </div>
        </div>
      </section>

      {/* FAQ + CTA FINAL */}
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-20 sm:px-6 sm:pt-28 sm:pb-28 lg:px-8">
        <section aria-labelledby="faq-title" className="mx-auto max-w-3xl">
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

        <div className="overflow-hidden rounded-[2rem] bg-primary px-6 py-12 text-center text-primary-foreground shadow-lift sm:px-12 sm:py-16">
          <p className="text-xs font-semibold tracking-[0.16em] text-sky uppercase">
            Votre prochaine étape
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
            Lancez votre vitrine numérique avec SAVPAY.
          </h2>
          <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
            Donnez à vos ressources un espace clair, personnel et prêt à être découvert.
          </p>
          <Button
            asChild
            size="lg"
            className="mt-8 min-h-12 bg-white px-7 text-foreground hover:bg-secondary"
          >
            <Link href="/dashboard/devenir-vendeur">Créer ma boutique</Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
