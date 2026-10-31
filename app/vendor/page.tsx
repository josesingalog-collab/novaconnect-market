import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getCurrentProfile } from "@/lib/profile";
import { getVendorDashboard } from "@/services/vendor/dashboard";

export const metadata: Metadata = {
  title: "Ma boutique",
  robots: { index: false, follow: false },
};

const statusLabels: Record<string, { label: string; variant: "success" | "warning" | "destructive" }> = {
  ACTIVE: { label: "Boutique active", variant: "success" },
  PENDING: { label: "En cours d'activation", variant: "warning" },
  REJECTED: { label: "Modifications demandées", variant: "destructive" },
  SUSPENDED: { label: "Boutique suspendue", variant: "destructive" },
};

function ShopIcon() {
  return (
    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M3 10.5 4.5 4h15l1.5 6.5M5 10.5V20h14v-9.5M3 10.5a3 3 0 0 0 5.5 1.7 3 3 0 0 0 5 0 3 3 0 0 0 5 0 3 3 0 0 0 5.5-1.7"
      />
    </svg>
  );
}

export default async function VendorPage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor");
  }

  if (current.kind === "missing-profile") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Alert variant="error">Profil introuvable. Déconnectez-vous puis reconnectez-vous.</Alert>
      </main>
    );
  }

  if (current.profile.role === "ADMIN") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 px-4 py-12 sm:px-6">
        <Alert variant="info" title="Console administrateur">
          Les administrateurs gèrent les boutiques depuis la{" "}
          <Link href="/admin" className="font-medium underline-offset-4 hover:underline">
            console admin
          </Link>
          .
        </Alert>
      </main>
    );
  }

  const dashboard = await getVendorDashboard();
  const shop = dashboard.shop;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-7 px-4 py-10 sm:px-6 lg:py-14">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
            Espace vendeur
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Ma boutique
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gérez votre vitrine et les produits que vous proposez.
          </p>
        </div>
        {shop?.status === "ACTIVE" && (
          <Button asChild className="min-h-11 shrink-0">
            <Link href="/vendor/catalogue/nouveau">Créer un produit</Link>
          </Button>
        )}
      </header>

      {shop === null ? (
        <EmptyState
          icon={<ShopIcon />}
          title="Aucune boutique pour le moment"
          description="Créez votre boutique pour commencer à présenter et vendre vos produits numériques."
          action={{ label: "Créer ma boutique", href: "/dashboard/devenir-vendeur" }}
          className="py-10"
        />
      ) : (
        <>
          <Link
            href="/vendor/catalogue"
            className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
          >
            {shop.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- URL de logo fournie par le vendeur.
              <img
                src={shop.logoUrl}
                alt=""
                className="h-14 w-14 shrink-0 rounded-xl border border-border object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">
                {shop.storeName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold text-foreground">{shop.storeName}</h2>
                <Badge variant={statusLabels[shop.status]?.variant ?? "secondary"}>
                  {statusLabels[shop.status]?.label ?? shop.status}
                </Badge>
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">/boutique/{shop.slug}</p>
              {shop.description && (
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {shop.description}
                </p>
              )}
            </div>
            <span className="shrink-0 text-2xl text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true">
              →
            </span>
          </Link>

          <section aria-label="Gérer ma boutique" className="grid gap-3 sm:grid-cols-2">
            <Link
              href="/vendor/catalogue"
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <p className="text-base font-semibold text-foreground">Catalogue</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {dashboard.products.total} produit{dashboard.products.total > 1 ? "s" : ""} dans votre boutique
              </p>
            </Link>
            <Link
              href="/vendor/ventes"
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <p className="text-base font-semibold text-foreground">Ventes</p>
              <p className="mt-1 text-sm text-muted-foreground">Suivez vos commandes et revenus</p>
            </Link>
            <Link
              href="/vendor/finances"
              className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
            >
              <p className="text-base font-semibold text-foreground">Finances</p>
              <p className="mt-1 text-sm text-muted-foreground">Consultez vos soldes disponibles</p>
            </Link>
            {shop.status === "ACTIVE" ? (
              <Link
                href={`/boutique/${shop.slug}`}
                className="rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-sm"
              >
                <p className="text-base font-semibold text-foreground">Voir ma boutique</p>
                <p className="mt-1 text-sm text-muted-foreground">Ouvrez votre vitrine publique</p>
              </Link>
            ) : (
              <div className="rounded-xl border border-border bg-muted/40 p-5">
                <p className="text-base font-semibold text-foreground">Vitrine publique</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Disponible après l&apos;activation de votre boutique.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
