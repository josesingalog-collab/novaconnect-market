import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Acheteur",
  VENDOR: "Vendeur",
  ADMIN: "Administrateur",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  // Double vérification serveur (le middleware est une barrière d'UX seulement)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    redirect("/login?next=/dashboard");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name, email, role, status, created_at")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
            NovaConnect Market · Espace personnel
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Bonjour {profile?.full_name !== undefined && profile.full_name.length > 0 ? profile.full_name : "👋"}
          </h1>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Déconnexion
          </button>
        </form>
      </div>

      {error !== null ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Profil introuvable ({error.message}). Si tu viens de créer le compte, réessaie dans un instant.
        </div>
      ) : (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <h2 className="mb-4 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
            Profil (lu via RLS — table profiles)
          </h2>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Nom complet</dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                {profile?.full_name !== undefined && profile.full_name.length > 0 ? profile.full_name : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Email</dt>
              <dd className="text-sm font-medium break-all text-zinc-900 dark:text-zinc-100">{profile?.email ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Rôle</dt>
              <dd>
                <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                  {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role} ({profile?.role})
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-zinc-500 dark:text-zinc-400">Statut</dt>
              <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{profile?.status}</dd>
            </div>
          </dl>
        </section>
      )}

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-3 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Mes espaces
        </h2>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/dashboard/profil"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Mon profil
          </Link>
          <Link
            href="/dashboard/mot-de-passe"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Mot de passe
          </Link>
          <Link
            href="/dashboard/commandes"
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Mes commandes
          </Link>
          {profile?.role === "VENDOR" && (
            <Link
              href="/vendor"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Espace vendeur
            </Link>
          )}
          {profile?.role === "BUYER" && (
            <Link
              href="/dashboard/devenir-vendeur"
              className="rounded-lg border border-dashed border-zinc-400 px-3 py-1.5 text-sm font-medium text-zinc-800 transition-colors hover:border-zinc-900 hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-200 dark:hover:border-zinc-300 dark:hover:bg-zinc-800"
            >
              ✨ Devenir vendeur
            </Link>
          )}
          {profile?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Console admin
            </Link>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        <p className="font-medium text-zinc-800 dark:text-zinc-200">Prochaines phases</p>
        <ul className="mt-2 list-inside list-disc space-y-1">
          <li>Phase 6+ : panier, commandes et paiements</li>
        </ul>
        <Link href="/" className="mt-4 inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
          ← Retour à l&apos;accueil
        </Link>
      </section>
    </main>
  );
}
