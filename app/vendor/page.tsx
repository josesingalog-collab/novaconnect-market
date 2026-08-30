import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listMyProducts } from "@/services/products/manage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { formatPrice } from "@/components/marketplace/format";

export const metadata: Metadata = {
  title: "Espace vendeur",
  robots: { index: false, follow: false },
};

type VendorStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

interface VendorRow {
  id: string;
  store_name: string;
  slug: string;
  description: string | null;
  status: VendorStatus;
  created_at: string;
}

const STATUS_BADGES: Record<VendorStatus, { label: string; variant: "warning" | "success" | "destructive" | "secondary" }> = {
  PENDING: { label: "En attente", variant: "warning" },
  ACTIVE: { label: "Active", variant: "success" },
  REJECTED: { label: "Refusée", variant: "destructive" },
  SUSPENDED: { label: "Suspendue", variant: "destructive" },
};

const PRODUCT_STATUS_BADGES: Record<string, { label: string; variant: "secondary" | "warning" | "success" | "destructive" | "outline" }> = {
  DRAFT: { label: "Brouillon", variant: "secondary" },
  PENDING_REVIEW: { label: "En relecture", variant: "warning" },
  PUBLISHED: { label: "Publié", variant: "success" },
  REJECTED: { label: "Rejeté", variant: "destructive" },
  ARCHIVED: { label: "Archivé", variant: "outline" },
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function EmptyProducts() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center">
      <p className="text-3xl" aria-hidden="true">📦</p>
      <h3 className="mt-3 text-sm font-semibold text-foreground">Aucun produit pour le moment</h3>
      <p className="mt-1 text-sm text-muted-foreground">Crée ton premier produit pour commencer à vendre.</p>
      <div className="mt-4 flex justify-center gap-3">
        <Button asChild>
          <Link href="/vendor/catalogue/nouveau">+ Ajouter un produit</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/vendor/catalogue">Voir le catalogue</Link>
        </Button>
      </div>
    </div>
  );
}

export default async function VendorPage({ searchParams }: { searchParams: Promise<{ bienvenue?: string }> }) {
  const { bienvenue } = await searchParams;
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor");
  }

  if (current.kind === "missing-profile") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-12 lg:px-6">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Profil introuvable. Déconnecte-toi puis reconnecte-toi pour réessayer.
        </div>
      </main>
    );
  }

  const isAdmin = current.profile.role === "ADMIN";
  const supabase = await createSupabaseServerClient();

  const shop = isAdmin ? null : await supabase
    .from("vendors")
    .select("id, store_name, slug, description, status, created_at")
    .eq("user_id", current.profile.id)
    .maybeSingle()
    .then((res) => (res.data as VendorRow | null) ?? null);

  const products = shop ? await listMyProducts(supabase, shop.id) : [];

  return (
    <div className="mx-auto max-w-5xl flex-1 flex flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      {/* Welcome */}
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          NovaConnect Market
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Bonjour{current.profile.fullName ? ` ${current.profile.fullName}` : ""}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {shop ? `${shop.store_name} — voici un aperçu de ta boutique.` : "Bienvenue sur ton espace vendeur."}
        </p>
      </div>

      {bienvenue === undefined ? null : (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✅ Boutique créée ! Ton profil est maintenant « Vendeur ». Elle est en attente de validation par un administrateur avant d&apos;être visible publiquement.
        </div>
      )}

      {isAdmin ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">
              Les administrateurs gèrent les validations depuis la{" "}
              <Link href="/admin" className="font-medium text-foreground underline-offset-4 hover:underline">
                console admin
              </Link>
              . Cet espace concerne les boutiques des vendeurs.
            </p>
          </CardContent>
        </Card>
      ) : shop === null ? (
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/50 p-8 text-center">
          <p className="text-3xl" aria-hidden="true">🏪</p>
          <h2 className="mt-3 text-lg font-semibold tracking-tight text-foreground">
            Tu n&apos;as pas encore de boutique
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Crée ta boutique en quelques minutes : ton profil devient vendeur automatiquement.
          </p>
          <Button asChild className="mt-5">
            <Link href="/dashboard/devenir-vendeur">✨ Devenir vendeur</Link>
          </Button>
          <Link href="/dashboard" className="mt-4 text-sm font-medium text-foreground underline-offset-4 hover:underline">
            ← Retour au tableau de bord
          </Link>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card interactive className="cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Ajouter un produit</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">+ Nouveau</p>
                  </div>
                  <span className="rounded-lg bg-primary/10 p-2 text-primary">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/vendor/catalogue/nouveau">Créer</Link>
                </Button>
              </CardFooter>
            </Card>
            <Card interactive className="cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Mes produits</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">{products.length}</p>
                  </div>
                  <span className="rounded-lg bg-secondary p-2 text-secondary-foreground">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/vendor/catalogue">Voir tout</Link>
                </Button>
              </CardFooter>
            </Card>
            <Card interactive className="cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Commandes</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">—</p>
                  </div>
                  <span className="rounded-lg bg-secondary p-2 text-secondary-foreground">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/vendor/commandes">Voir</Link>
                </Button>
              </CardFooter>
            </Card>
            <Card interactive className="cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">Revenus</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">—</p>
                  </div>
                  <span className="rounded-lg bg-secondary p-2 text-secondary-foreground">
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </span>
                </div>
              </CardContent>
              <CardFooter className="pt-0">
                <Button variant="outline" size="sm" asChild className="w-full">
                  <Link href="/vendor/revens">Voir</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Store Status */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>Ma boutique</CardTitle>
                  <CardDescription>{shop.store_name}</CardDescription>
                </div>
                <Badge variant={STATUS_BADGES[shop.status].variant}>{STATUS_BADGES[shop.status].label}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">Adresse publique</dt>
                  <dd className="text-sm font-medium text-foreground">
                    <Link href={`/boutique/${shop.slug}`} className="hover:underline">
                      /boutique/{shop.slug}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Créée le</dt>
                  <dd className="text-sm font-medium text-foreground">{formatDate(shop.created_at)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-xs text-muted-foreground">Description</dt>
                  <dd className="text-sm text-foreground">{shop.description ?? "—"}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Recent Products */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Produits récents</CardTitle>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/vendor/catalogue">Voir tout</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {products.length === 0 ? (
                <EmptyProducts />
              ) : (
                <ul className="divide-y divide-border" role="list">
                  {products.map((product) => (
                    <li key={product.id} className="flex items-center gap-4 p-4 hover:bg-muted/50">
                      {product.thumbnailUrl ? (
                        <img
                          src={product.thumbnailUrl}
                          alt={product.title}
                          className="h-12 w-12 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
                          {product.title.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{product.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant={PRODUCT_STATUS_BADGES[product.status]?.variant ?? "secondary"}>
                            {PRODUCT_STATUS_BADGES[product.status]?.label ?? product.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatPrice(product.price, product.currency)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/vendor/catalogue/${product.id}/edit`} aria-label={`Modifier ${product.title}`}>
                            Modifier
                          </Link>
                        </Button>
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/vendor/catalogue/${product.id}/edit`} aria-label={`Voir ${product.title}`}>
                            Voir
                          </Link>
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Link href="/dashboard" className="inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline">
            ← Retour au tableau de bord
          </Link>
        </>
      )}
    </div>
  );
}