import Link from "next/link";
import { getCurrentProfile } from "@/lib/profile";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/config";

export async function SiteFooter() {
  const current = await getCurrentProfile();
  const connected = current.kind === "ok";

  return (
    <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
            <span aria-hidden className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
              NC
            </span>
            {APP_NAME}
          </p>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{APP_DESCRIPTION}</p>
        </div>

        <nav aria-label="Explorer">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Explorer
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><Link href="/" className={LINK_CLASS_FOOTER}>Accueil</Link></li>
            <li><Link href="/catalogue" className={LINK_CLASS_FOOTER}>Catalogue</Link></li>
            <li><Link href="/#categories" className={LINK_CLASS_FOOTER}>Catégories</Link></li>
          </ul>
        </nav>

        <nav aria-label="Vendeurs">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Vendeurs
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li>
              <Link
                href={connected && current.profile.role === "BUYER" ? "/dashboard/devenir-vendeur" : "/#devenir-vendeur"}
                className={LINK_CLASS_FOOTER}
              >
                Devenir vendeur
              </Link>
            </li>
            {connected && current.profile.role === "VENDOR" && (
              <li><Link href="/vendor" className={LINK_CLASS_FOOTER}>Espace vendeur</Link></li>
            )}
          </ul>
        </nav>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            Infos
          </p>
          <ul className="mt-3 space-y-2 text-sm">
            <li><span className={SPAN_CLASS_FOOTER}>Conditions générales · bientôt</span></li>
            <li><span className={SPAN_CLASS_FOOTER}>Confidentialité · bientôt</span></li>
            <li>
              <a href="mailto:contact@novaconnect.market" className={LINK_CLASS_FOOTER}>
                contact@novaconnect.market
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-200 py-5 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        © {new Date().getFullYear()} {APP_NAME} — Kinshasa, RDC. Tous droits réservés.
      </div>
    </footer>
  );
}

const LINK_CLASS_FOOTER =
  "text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";
const SPAN_CLASS_FOOTER = "text-zinc-400 dark:text-zinc-600";
