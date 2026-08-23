import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
        Marketplace SaaS · Produits numériques · Afrique francophone
      </p>
      <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        {APP_NAME}
      </h1>
      <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
        {APP_DESCRIPTION}
      </p>
      <div className="rounded-full border border-zinc-200 px-4 py-1.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Phase 1 — Fondations techniques initialisées
      </div>
    </main>
  );
}
