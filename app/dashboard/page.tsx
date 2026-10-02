import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatMinorAmount, parseAmountToMinor, type CurrencyCode } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Mon espace",
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Acheteur",
  VENDOR: "Vendeur",
  ADMIN: "Administrateur",
};

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  PENDING: {
    label: "En attente",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  PAID: {
    label: "Payée",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  CANCELLED: {
    label: "Annulée",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  REFUNDED: {
    label: "Remboursée",
    className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
};

function money(amount: string, currency: string): string {
  return formatMinorAmount(
    parseAmountToMinor(amount, currency as CurrencyCode),
    currency as CurrencyCode,
  );
}

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user === null) {
    redirect("/login?next=/dashboard");
  }

  const current = await getCurrentProfile();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name, email, role, status, created_at")
    .eq("id", user.id)
    .single();

  // Commandes récentes (5 dernières)
  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, subtotal, discount, total, currency, status, created_at")
    .eq("buyer_id", current.kind === "ok" ? current.profile.id : user.id)
    .order("created_at", { ascending: false })
    .limit(5);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Mon espace" }]} />

      {/* HEADER */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
            NovaConnect Market · Espace personnel
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Bonjour
            {profile?.full_name !== undefined && profile.full_name.length > 0
              ? ` ${profile.full_name}`
              : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bienvenue dans votre espace NovaConnect.
          </p>
        </div>
        <form action={logoutAction}>
          <Button variant="outline" type="submit">
            Déconnexion
          </Button>
        </form>
      </div>

      {/* PROFIL ERROR */}
      {profileError !== null && (
        <Alert variant="error" title="Profil introuvable">
          Si vous venez de créer votre compte, réessayez dans un instant.
        </Alert>
      )}

      {/* ACCÈS RAPIDES */}
      <section aria-label="Accès rapides">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Accès rapides
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/dashboard/commandes"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden="true"
            >
              📦
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Mes commandes</p>
              <p className="text-xs text-muted-foreground">Suivre et télécharger</p>
            </div>
          </Link>
          <Link
            href="/dashboard/profil"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden="true"
            >
              👤
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Mon profil</p>
              <p className="text-xs text-muted-foreground">Modifier mes informations</p>
            </div>
          </Link>
          <Link
            href="/dashboard/mot-de-passe"
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden="true"
            >
              🔒
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">Sécurité du compte</p>
              <p className="text-xs text-muted-foreground">Changer mon mot de passe</p>
            </div>
          </Link>
          {profile?.role === "VENDOR" && (
            <Link
              href="/vendor"
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                aria-hidden="true"
              >
                🏪
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Espace vendeur</p>
                <p className="text-xs text-muted-foreground">Gérer ma boutique</p>
              </div>
            </Link>
          )}
          {profile?.role === "BUYER" && (
            <Link
              href="/dashboard/devenir-vendeur"
              className="border-input flex items-center gap-3 rounded-xl border border-dashed bg-background p-4 transition-colors hover:bg-accent"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                aria-hidden="true"
              >
                ✨
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Devenir vendeur</p>
                <p className="text-xs text-muted-foreground">Créer votre boutique</p>
              </div>
            </Link>
          )}
          {profile?.role === "ADMIN" && (
            <Link
              href="/admin"
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <span
                className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                aria-hidden="true"
              >
                ⚙️
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Console admin</p>
                <p className="text-xs text-muted-foreground">Gérer la plateforme</p>
              </div>
            </Link>
          )}
        </div>
      </section>

      {/* MES DERNIÈRES COMMANDES */}
      <section aria-label="Mes dernières commandes" className="scroll-mt-20">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Mes dernières commandes
          </h2>
          <Link
            href="/dashboard/commandes"
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Voir toutes mes commandes →
          </Link>
        </div>

        {orders === null || orders.length === 0 ? (
          <EmptyState
            icon={<span aria-hidden="true">📦</span>}
            title="Vous n'avez encore aucune commande"
            description="Découvrez les produits digitaux disponibles sur NovaConnect."
            action={{ label: "Explorer le catalogue", href: "/catalogue" }}
          />
        ) : (
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-background">
            {orders.map((order) => {
              const badge = STATUS_BADGES[order.status] ?? {
                label: "Statut inconnu",
                className: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
              };
              return (
                <Link
                  key={order.id}
                  href="/dashboard/commandes"
                  className="flex flex-wrap items-center gap-3 p-4 transition-colors hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{order.order_number}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(order.created_at).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <p className="shrink-0 text-sm font-bold text-foreground">
                    {money(String(order.total), order.currency)}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* MON COMPTE */}
      <section aria-label="Mon compte" className="scroll-mt-20">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Mon compte
        </h2>
        <Card variant="bordered" className="p-6">
          <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-muted-foreground">Nom complet</dt>
              <dd className="text-sm font-medium text-foreground">
                {profile?.full_name !== undefined && profile.full_name.length > 0
                  ? profile.full_name
                  : "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-muted-foreground">Email</dt>
              <dd className="text-sm font-medium break-all text-foreground">
                {profile?.email ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-muted-foreground">Rôle</dt>
              <dd>
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                  {ROLE_LABELS[profile?.role ?? ""] ?? profile?.role}
                </span>
              </dd>
            </div>
            <div className="flex justify-between gap-4 sm:block">
              <dt className="text-sm text-muted-foreground">Statut</dt>
              <dd className="text-sm font-medium text-foreground">{profile?.status}</dd>
            </div>
          </dl>
        </Card>
      </section>
    </main>
  );
}
