import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Boutique",
};

export default function ShopPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Boutique vendeur
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Les vitrines complètes arrivent à la sous-étape S4 du chantier marketplace.
      </p>
      <Link href="/" className="text-sm font-medium underline-offset-4 hover:underline">
        ← Retour à l&apos;accueil
      </Link>
    </main>
  );
}
