import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Espace vendeur",
  robots: { index: false, follow: false },
};

export default function VendorPage() {
  return (
    <section className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
      <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Bienvenue dans ton espace vendeur
      </h1>
      <p className="mt-2">
        La création de boutique et la gestion du catalogue arrivent à la Phase 5. Cette page est
        volontairement minimale.
      </p>
      <Link href="/dashboard" className="mt-4 inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
        ← Retour au tableau de bord
      </Link>
    </section>
  );
}
