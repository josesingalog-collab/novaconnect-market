import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const current = await getCurrentProfile();
  if (current.kind === "unauthenticated") redirect("/login?next=/dashboard");
  if (current.kind === "missing-profile") {
    return (
      <main className="flex flex-1 items-center justify-center p-6 text-sm text-destructive">
        Profil introuvable. Reconnectez-vous puis réessayez.
      </main>
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: vendor } = await supabase
    .from("vendors")
    .select("store_name, slug, status")
    .eq("user_id", current.profile.id)
    .maybeSingle();
  const isVendor = current.profile.role === "VENDOR";

  return (
    <main className="flex min-h-full flex-1 flex-col bg-white">
      <header className="flex h-20 items-center justify-between border-b border-border px-5 sm:px-10">
        <Link href="/" className="flex items-center gap-2 text-lg font-semibold text-primary">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
            N
          </span>
          NovaConnect
        </Link>
        <form action={logoutAction}>
          <Button type="submit" variant="ghost">
            Déconnexion
          </Button>
        </form>
      </header>

      <section className="mx-auto flex w-full max-w-xl flex-1 items-center px-5 py-12">
        {isVendor ? (
          <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
                  Espace vendeur
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">
                  Ma boutique
                </h1>
              </div>
              {!vendor && (
                <Button asChild>
                  <Link href="/dashboard/devenir-vendeur">Créer une boutique</Link>
                </Button>
              )}
            </div>
            {vendor ? (
              <Link
                href="/vendor"
                className="mt-7 flex items-center gap-4 rounded-xl border border-border p-4 transition-colors hover:border-primary hover:bg-primary/[0.02]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-sm font-bold text-white">
                  {vendor.store_name.charAt(0).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-semibold text-foreground">
                    {vendor.store_name}
                  </span>
                  <span className="mt-1 block truncate text-sm text-muted-foreground">
                    novaconnect.app/boutique/{vendor.slug}
                  </span>
                </span>
                <span className="text-sm font-semibold text-primary">Gérer →</span>
              </Link>
            ) : (
              <p className="mt-7 rounded-xl bg-muted p-4 text-sm text-muted-foreground">
                Vous n&apos;avez pas encore créé de boutique.
              </p>
            )}
            <Link
              href="/catalogue"
              className="mt-6 block text-center text-sm font-medium text-primary hover:underline"
            >
              Voir les produits publiés
            </Link>
          </div>
        ) : (
          <div className="w-full text-center">
            <p className="text-xs font-semibold tracking-[0.16em] text-primary uppercase">
              Bienvenue {current.profile.fullName}
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-4xl">
              Que souhaitez-vous faire ?
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Découvrez les ressources de créateurs ou ouvrez votre propre boutique.
            </p>
            <div className="mt-9 grid gap-4 text-left sm:grid-cols-2">
              <Link
                href="/catalogue"
                className="rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary hover:bg-primary/[0.02]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-xl text-primary">
                  ⌕
                </span>
                <h2 className="mt-6 text-xl font-semibold text-foreground">Acheter</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Explorer les produits numériques publiés par les vendeurs.
                </p>
                <span className="mt-6 block text-sm font-semibold text-primary">
                  Voir les produits →
                </span>
              </Link>
              <Link
                href="/dashboard/devenir-vendeur"
                className="rounded-2xl bg-primary p-6 text-white shadow-lg shadow-primary/20 transition-colors hover:bg-primary/90"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl">
                  +
                </span>
                <h2 className="mt-6 text-xl font-semibold">Devenir vendeur</h2>
                <p className="mt-2 text-sm leading-6 text-white/75">
                  Créer votre boutique et vendre vos produits numériques.
                </p>
                <span className="mt-6 block text-sm font-semibold">Créer ma boutique →</span>
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
