import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { CartBadge } from "@/components/cart/cart-badge";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { getCurrentProfile } from "@/lib/profile";
import { APP_NAME } from "@/lib/config";

export async function SiteHeader() {
  const current = await getCurrentProfile();
  const connected = current.kind === "ok";

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/95">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-foreground"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            NC
          </span>
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        <nav aria-label="Navigation principale" className="hidden items-center gap-6 md:flex">
          <Link
            href="/#avantages"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Avantages
          </Link>
          <Link
            href="/catalogue"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Catalogue
          </Link>
          <Link
            href="/dashboard/devenir-vendeur"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Devenir vendeur
          </Link>
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {connected && <NotificationBell />}
          <CartBadge />
          {connected ? (
            <>
              {current.profile.role === "VENDOR" && (
                <Link
                  href="/vendor"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Espace vendeur
                </Link>
              )}
              {current.profile.role === "ADMIN" && (
                <Link
                  href="/admin"
                  className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Console admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Mon espace
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="rounded-md px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                >
                  Déconnexion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="border-input inline-flex items-center justify-center rounded-lg border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Créer un compte
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden">
          {connected && <NotificationBell />}
          <CartBadge />
        </div>

        <details className="group relative md:hidden">
          <summary
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent hover:text-accent-foreground [&::-webkit-details-marker]:hidden"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </summary>
          <div className="absolute top-12 right-0 flex w-60 flex-col gap-1 rounded-xl border border-border bg-background p-3 shadow-lg">
            <Link
              href="/#avantages"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Avantages
            </Link>
            <Link
              href="/catalogue"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Catalogue
            </Link>
              <Link
                href="/dashboard/devenir-vendeur"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
                Devenir vendeur
            </Link>
            <hr className="my-1 border-border" />
            {connected ? (
              <>
                <Link
                  href="/dashboard"
                  className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground"
                >
                  Mon espace
                </Link>
                {current.profile.role === "VENDOR" && (
                  <Link
                    href="/vendor"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Espace vendeur
                  </Link>
                )}
                {current.profile.role === "ADMIN" && (
                  <Link
                    href="/admin"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Console admin
                  </Link>
                )}
                <form action={logoutAction} className="px-2 pt-1">
                  <button
                    type="submit"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  >
                    Déconnexion
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="mt-1 flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </details>
      </div>
    </header>
  );
}
