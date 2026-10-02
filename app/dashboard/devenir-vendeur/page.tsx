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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
          NovaConnect Market · Vendeurs
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Devenir vendeur
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Un seul compte suffit : ton profil acheteur devient vendeur dès la création de ta boutique
          — sans nouvelle inscription.
        </p>
      </div>

      {current.kind === "missing-profile" ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          Profil introuvable. Déconnecte-toi puis reconnecte-toi pour réessayer.
        </div>
      ) : current.profile.role === "ADMIN" ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Les administrateurs gèrent les validations de boutiques depuis la{" "}
          <Link
            href="/admin"
            className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            console admin
          </Link>{" "}
          ; ils n&apos;ont pas besoin d&apos;une boutique dédiée.
        </div>
      ) : (
        <>
          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Ce que tu obtiens
            </h2>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
              {BENEFITS.map((benefit) => (
                <li key={benefit} className="flex gap-2">
                  <span aria-hidden>✓</span>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
              Créer ma boutique
            </h2>
            <CreateVendorForm />
          </section>

          <Link
            href="/dashboard"
            className="inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100"
          >
            ← Retour au tableau de bord
          </Link>
        </>
      )}
    </main>
  );
}
