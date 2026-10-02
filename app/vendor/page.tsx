import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { getVendorDashboard } from "@/services/vendor/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { formatPrice } from "@/components/marketplace/format";
import { formatMinorAmount, decimalStringToMinor } from "@/lib/money";

export const metadata: Metadata = {
  title: "Espace vendeur",
  robots: { index: false, follow: false },
};

type VendorStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

const VENDOR_STATUS_LABELS: Record<
  VendorStatus,
  { label: string; variant: "success" | "warning" | "destructive" }
> = {
  ACTIVE: { label: "Boutique active", variant: "success" },
  PENDING: { label: "Boutique en cours de validation", variant: "warning" },
  REJECTED: { label: "Modifications demandées", variant: "destructive" },
  SUSPENDED: { label: "Boutique suspendue", variant: "destructive" },
};

const PRODUCT_STATUS_LABELS: Record<
  string,
  { label: string; variant: "secondary" | "warning" | "default" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  PENDING_REVIEW: { label: "En cours de vérification", variant: "warning" },
  PUBLISHED: { label: "Publié", variant: "default" },
  REJECTED: { label: "Modifications demandées", variant: "destructive" },
  ARCHIVED: { label: "Archivé", variant: "outline" },
};

const ORDER_STATUS_LABELS: Record<
  string,
  { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }
> = {
  PENDING: { label: "En attente", variant: "warning" },
  PAID: { label: "Payée", variant: "success" },
  CANCELLED: { label: "Annulée", variant: "destructive" },
  REFUNDED: { label: "Remboursée", variant: "outline" },
  FAILED: { label: "Échouée", variant: "destructive" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRelativeDate(dateStr: string) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  return formatDate(dateStr);
}

function getProductActionLabel(product: { status: string; id: string; slug: string }): {
  label: string;
  href: string;
  variant: "default" | "outline";
} {
  if (product.status === "DRAFT")
    return { label: "Continuer", href: `/vendor/catalogue/${product.id}/edit`, variant: "outline" };
  if (product.status === "REJECTED")
    return { label: "Corriger", href: `/vendor/catalogue/${product.id}/edit`, variant: "default" };
  if (product.status === "PENDING_REVIEW")
    return { label: "Voir", href: `/vendor/catalogue/${product.id}/preview`, variant: "outline" };
  if (product.status === "PUBLISHED")
    return {
      label: "Voir le produit",
      href: `/produit/${encodeURIComponent(product.slug)}`,
      variant: "outline",
    };
  if (product.status === "ARCHIVED")
    return { label: "Voir", href: `/vendor/catalogue/${product.id}/edit`, variant: "outline" };
  return { label: "Voir", href: `/vendor/catalogue`, variant: "outline" };
}

function ShoppingIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
      />
    </svg>
  );
}

function PackageIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
      />
    </svg>
  );
}

function CurrencyIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

export default async function VendorPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const { bienvenue } = await searchParams;
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor");
  }

  if (current.kind === "missing-profile") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12 lg:px-6">
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          Profil introuvable. Déconnectez-vous puis reconnectez-vous pour réessayer.
        </div>
      </main>
    );
  }

  const isAdmin = current.profile.role === "ADMIN";

  const dashboard = isAdmin ? null : await getVendorDashboard();

  const data = dashboard;

  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      {/* HEADER */}
      <div>
        <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
          NovaConnect Market
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Bonjour{current.profile.fullName ? ` ${current.profile.fullName}` : ""} 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {data?.shop
            ? `Voici l&apos;état de votre boutique ${data.shop.storeName}.`
            : "Voici l&apos;espace dédié à votre activité de vendeur."}
        </p>
      </div>

      {bienvenue === undefined ? null : (
        <Alert variant="success" title="Boutique créée !">
          Votre profil est maintenant « Vendeur ». Elle est en cours de validation par un
          administrateur avant d&apos;être visible publiquement.
        </Alert>
      )}

      {isAdmin ? (
        <Alert variant="info" title="Console administrateur">
          Les administrateurs gèrent les validations depuis la{" "}
          <Link href="/admin" className="font-medium underline-offset-4 hover:underline">
            console admin
          </Link>
          .
        </Alert>
      ) : !data ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center">
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <PackageIcon />
          </span>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
            Vous n&apos;avez pas encore de boutique
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Créez votre boutique en quelques minutes : votre profil devient vendeur automatiquement.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/devenir-vendeur">✨ Devenir vendeur</Link>
          </Button>
          <Link
            href="/dashboard"
            className="mt-4 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            ← Retour au tableau de bord
          </Link>
        </div>
      ) : (
        <>
          {/* BOUTIQUE STATUS */}
          {data.shop && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <h2 className="text-lg font-semibold tracking-tight text-foreground">
                        {data.shop.storeName}
                      </h2>
                      <Badge
                        variant={
                          VENDOR_STATUS_LABELS[data.shop.status as VendorStatus]?.variant ??
                          "secondary"
                        }
                      >
                        {VENDOR_STATUS_LABELS[data.shop.status as VendorStatus]?.label ??
                          data.shop.status}
                      </Badge>
                    </div>
                    {data.shop.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{data.shop.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/boutique/${data.shop.slug}`}>Voir ma boutique</Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href="/vendor/catalogue/nouveau">Ajouter un produit</Link>
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Adresse publique</p>
                    <p className="text-sm font-medium text-foreground">
                      <Link href={`/boutique/${data.shop.slug}`} className="hover:underline">
                        /boutique/{data.shop.slug}
                      </Link>
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Créée le</p>
                    <p className="text-sm font-medium text-foreground">
                      {formatDate(data.shop.createdAt)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* STATISTIQUES */}
          <section aria-label="Statistiques">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Vue d&apos;ensemble
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              <StatCard label="Produits" value={data.products.total} description="Au total" />
              <StatCard
                label="Publiés"
                value={data.products.published}
                description="Visibles au public"
              />
              <StatCard
                label="Vérification"
                value={data.products.pendingReview}
                description="En attente"
              />
              <StatCard label="Brouillons" value={data.products.drafts} description="En cours" />
              <StatCard
                label="Modifications"
                value={data.products.rejected}
                description="À corriger"
              />
            </div>
          </section>

          {/* REVENUS PAR DEVISE */}
          <section aria-label="Revenus">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Revenus
              </h2>
              <Link
                href="/vendor/catalogue"
                className="text-sm font-medium text-primary hover:underline"
              >
                Voir tout le catalogue →
              </Link>
            </div>
            {data.sales.revenuesByCurrency.length === 0 ? (
              <EmptyState
                icon={
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <CurrencyIcon />
                  </span>
                }
                title="Pas encore de revenus"
                description="Vos revenus apparaîtront ici dès qu'un client achètera l'un de vos produits."
                action={{ label: "Voir mon catalogue", href: "/vendor/catalogue" }}
              />
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.sales.revenuesByCurrency.map((rev) => (
                  <Card key={rev.currency} variant="bordered">
                    <CardContent className="pt-6">
                      <p className="text-sm font-medium text-muted-foreground">{rev.currency}</p>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        {formatMinorAmount(
                          decimalStringToMinor(rev.totalRevenue, rev.currency as "USD" | "CDF"),
                          rev.currency as "USD" | "CDF",
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {rev.totalSales} vente{rev.totalSales > 1 ? "s" : ""} payée
                        {rev.totalSales > 1 ? "s" : ""}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {/* VENTES RÉCENTES */}
          <section aria-label="Ventes récentes">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
              Ventes récentes
            </h2>
            {data.sales.recentOrders.length === 0 ? (
              <EmptyState
                icon={
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <ShoppingIcon />
                  </span>
                }
                title="Pas encore de vente"
                description="Vos ventes apparaîtront ici dès qu'un client achètera l'un de vos produits."
                action={{ label: "Voir mon catalogue", href: "/vendor/catalogue" }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {data.sales.recentOrders.map((order) => {
                  const statusBadge = ORDER_STATUS_LABELS[order.status] ?? {
                    label: order.status,
                    variant: "secondary" as const,
                  };
                  return (
                    <Card key={order.id} variant="bordered">
                      <CardContent className="flex items-center justify-between gap-4 p-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground">
                              {order.orderNumber}
                            </p>
                            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                            <span>{formatRelativeDate(order.createdAt)}</span>
                            <span>
                              {order.productCount} produit{order.productCount > 1 ? "s" : ""}
                            </span>
                          </div>
                        </div>
                        <p className="text-base font-bold text-foreground">
                          {formatPrice(order.vendorAmount, order.currency)}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* REVENUS DISPONIBLES (BALANCES) */}
          {data.balances && data.balances.length > 0 && (
            <section aria-label="Revenus disponibles">
              <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Solde disponible
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {data.balances.map((balance) => (
                  <Card key={balance.currency} variant="bordered">
                    <CardContent className="pt-6">
                      <p className="text-sm font-medium text-muted-foreground">
                        {balance.currency}
                      </p>
                      <p className="mt-1 text-2xl font-bold text-foreground">
                        {formatMinorAmount(
                          decimalStringToMinor(
                            balance.availableBalance,
                            balance.currency as "USD" | "CDF",
                          ),
                          balance.currency as "USD" | "CDF",
                        )}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Comptable : {formatPrice(balance.accountingBalance, balance.currency)}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* MES PRODUITS RÉCENTS */}
          <section aria-label="Produits récents">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                Mes derniers produits
              </h2>
              <Link
                href="/vendor/catalogue"
                className="text-sm font-medium text-primary hover:underline"
              >
                Voir tout le catalogue →
              </Link>
            </div>
            {data.products.items.length === 0 ? (
              <EmptyState
                icon={
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground"
                    aria-hidden="true"
                  >
                    <PackageIcon />
                  </span>
                }
                title="Aucun produit pour le moment"
                description="Créez votre premier produit pour construire votre catalogue."
                action={{ label: "Créer votre premier produit", href: "/vendor/catalogue/nouveau" }}
              />
            ) : (
              <div className="flex flex-col gap-3">
                {data.products.items.slice(0, 5).map((product) => {
                  const action = getProductActionLabel(product);
                  return (
                    <Card key={product.id} variant="bordered">
                      <CardContent className="flex items-center gap-4 p-4">
                        {product.thumbnailUrl ? (
                          <Image
                            src={product.thumbnailUrl}
                            alt={product.title}
                            className="h-12 w-12 rounded-lg object-cover"
                            width={48}
                            height={48}
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
                            {product.title.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {product.title}
                            </p>
                            <Badge
                              variant={
                                PRODUCT_STATUS_LABELS[product.status]?.variant ?? "secondary"
                              }
                            >
                              {PRODUCT_STATUS_LABELS[product.status]?.label ?? product.status}
                            </Badge>
                          </div>
                          <div className="mt-0.5 flex items-center gap-3 text-sm text-muted-foreground">
                            {product.categoryName && <span>{product.categoryName}</span>}
                            {product.price && (
                              <span>{formatPrice(product.price, product.currency)}</span>
                            )}
                          </div>
                        </div>
                        <Button variant={action.variant} size="sm" asChild className="shrink-0">
                          <Link href={action.href}>{action.label}</Link>
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* GUIDE DÉBUTANT — uniquement si aucun produit */}
          {data.products.total === 0 && (
            <Card variant="bordered">
              <CardContent className="pt-6">
                <h2 className="mb-4 text-lg font-semibold tracking-tight text-foreground">
                  Comment vendre sur NovaConnect ?
                </h2>
                <ol className="space-y-3 text-sm text-muted-foreground">
                  {[
                    "Créez votre premier produit (titre, description, prix, catégorie)",
                    "Ajoutez une image de couverture",
                    "Ajoutez votre fichier numérique",
                    "Vérifiez que tout est correct",
                    "Envoyez-le en validation",
                    "Une fois validé, votre produit est publié et visible au public",
                  ].map((step, i) => (
                    <li key={step} className="flex items-start gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          <Link
            href="/dashboard"
            className="inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            ← Retour au tableau de bord
          </Link>
        </>
      )}
    </div>
  );
}
