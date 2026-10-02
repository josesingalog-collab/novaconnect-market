import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";

export async function SiteFooter() {
  const current = await getCurrentProfile();
  const connected = current.kind === "ok";

  return (
    <footer className="border-t border-border bg-primary text-primary-foreground">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-4 lg:gap-12 lg:px-8">
        <div className="lg:col-span-1">
          <p className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/20 text-sm font-bold text-primary-foreground">
              NC
            </span>
            {APP_NAME}
          </p>
          <p className="mt-3 text-sm leading-6 text-primary-foreground/70">{APP_DESCRIPTION}</p>
        </div>

        <nav aria-label="Explorer">
          <p className="text-xs font-semibold tracking-widest text-primary-foreground/60 uppercase">
            Découvrir
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Accueil
              </Link>
            </li>
            <li>
              <Link
                href="/catalogue"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Catalogue
              </Link>
            </li>
            <li>
              <Link
                href="/catalogue"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Catégories
              </Link>
            </li>
          </ul>
        </nav>

        <nav aria-label="Créer">
          <p className="text-xs font-semibold tracking-widest text-primary-foreground/60 uppercase">
            Créer
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <a
                href="/dashboard/devenir-vendeur"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Devenir vendeur
              </a>
            </li>
            {connected && current.profile.role === "VENDOR" && (
              <li>
                <Link
                  href="/vendor"
                  className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
                >
                  Espace vendeur
                </Link>
              </li>
            )}
          </ul>
        </nav>

        <nav aria-label="Aide et compte">
          <p className="text-xs font-semibold tracking-widest text-primary-foreground/60 uppercase">
            Compte & Aide
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href="/login"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Connexion
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                Créer un compte
              </Link>
            </li>
            <li>
              <a
                href="mailto:contact@novaconnect.market"
                className="text-primary-foreground/70 transition-colors hover:text-primary-foreground"
              >
                contact@novaconnect.market
              </a>
            </li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-primary-foreground/10 py-5 text-center text-xs text-primary-foreground/50">
        © {new Date().getFullYear()} {APP_NAME} — Tous droits réservés.
      </div>
    </footer>
  );
}
