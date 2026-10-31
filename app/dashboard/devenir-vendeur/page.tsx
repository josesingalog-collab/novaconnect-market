import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CreateVendorForm } from "@/components/vendor/create-vendor-form";
import { getCurrentProfile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Devenir vendeur",
  robots: { index: false, follow: false },
};

const BENEFITS = [
  "Un espace boutique avec ton adresse dédiée (/boutique/ton-nom)",
  "Publication de produits numériques : ebooks, templates, formations…",
  "Paiement sécurisé et suivi des ventes depuis ton tableau de bord",
];

export default async function BecomeVendorPage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/devenir-vendeur");
  }

  if (current.kind === "ok" && current.profile.role === "VENDOR") {
    redirect("/vendor");
  }

  return (
    <main className="mx-auto grid w-full max-w-5xl flex-1 gap-10 px-6 py-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start lg:py-20">
      <section className="rounded-3xl bg-primary p-7 text-primary-foreground lg:sticky lg:top-8">
        <p className="text-xs font-bold tracking-[0.14em] text-primary-foreground/65 uppercase">
          NovaConnect · Vendeurs
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Ouvrez votre vitrine.</h1>
        <p className="mt-4 text-sm leading-6 text-primary-foreground/75">
          Un seul compte suffit. Votre espace vendeur est activé dès la création de votre boutique.
        </p>
        <div className="mt-8 border-t border-primary-foreground/15 pt-6">
          <p className="text-sm font-semibold">Simple et progressif</p>
          <p className="mt-2 text-sm leading-6 text-primary-foreground/70">
            Commencez avec les informations essentielles, puis ajoutez vos produits depuis votre
            tableau de bord.
          </p>
        </div>
      </section>

      {current.kind === "missing-profile" ? (
        <div
          role="alert"
          className="rounded-2xl border border-destructive/20 bg-destructive/10 p-5 text-sm text-destructive"
        >
          Profil introuvable. Déconnecte-toi puis reconnecte-toi pour réessayer.
        </div>
      ) : current.profile.role === "ADMIN" ? (
        <div className="rounded-2xl border border-border bg-card p-6 text-sm leading-6 text-muted-foreground shadow-sm">
          Les administrateurs gèrent la plateforme depuis la{" "}
          <Link
            href="/admin"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            console admin
          </Link>{" "}
          ; ils n&apos;ont pas besoin d&apos;une boutique dédiée.
        </div>
      ) : (
        <>
          <section className="rounded-3xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-[0.14em] text-primary uppercase">
                  Étape 1 sur 1
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  Parlez-nous de votre boutique
                </h2>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                1
              </span>
            </div>
            <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-full rounded-full bg-primary" />
            </div>
            <ul className="mt-7 space-y-3 rounded-2xl bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <span aria-hidden className="font-bold text-success">
                    ✓
                  </span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
            <div className="mt-7">
              <CreateVendorForm />
            </div>
          </section>

          <Link
            href="/dashboard"
            className="inline-block text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            ← Retour au tableau de bord
          </Link>
        </>
      )}
    </main>
  );
}
