import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { getCurrentProfile } from "@/lib/profile";
import { APP_NAME } from "@/lib/config";

const LINK_CLASS =
  "text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100";

export async function SiteHeader() {
  const current = await getCurrentProfile();
  const connected = current.kind === "ok";
  const vendorLinkHref =
    connected && current.profile.role === "BUYER" ? "/dashboard/devenir-vendeur" : "/#devenir-vendeur";
  const NAV_LINKS = [
    { href: "/catalogue", label: "Catalogue" },
    { href: "/#categories", label: "Catégories" },
    { href: vendorLinkHref, label: "Devenir vendeur" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-semibold tracking-tight text-zinc-900 dark:text-zinc-50"
        >
          <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
            NC
          </span>
          <span className="hidden sm:inline">{APP_NAME}</span>
        </Link>

        {/* Navigation bureau */}
        <nav aria-label="Navigation principale" className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className={LINK_CLASS}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {connected ? (
            <>
              {current.profile.role === "VENDOR" && (
                <Link href="/vendor" className={LINK_CLASS}>
                  Espace vendeur
                </Link>
              )}
              {current.profile.role === "ADMIN" && (
                <Link href="/admin" className={LINK_CLASS}>
                  Console admin
                </Link>
              )}
              <Link
                href="/dashboard"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Mon espace
              </Link>
              <form action={logoutAction}>
                <button type="submit" className={LINK_CLASS}>
                  Déconnexion
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className={LINK_CLASS}>
                Connexion
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                Créer un compte
              </Link>
            </>
          )}
        </div>

        {/* Menu mobile sans JavaScript */}
        <details className="group relative md:hidden">
          <summary
            aria-label="Ouvrir le menu"
            className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300 [&::-webkit-details-marker]:hidden"
          >
            ☰
          </summary>
          <div className="absolute right-0 top-11 flex w-56 flex-col gap-1 rounded-xl border border-zinc-200 bg-white p-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={`rounded-lg px-2 py-1.5 ${LINK_CLASS}`}>
                {link.label}
              </Link>
            ))}
            <hr className="my-1 border-zinc-200 dark:border-zinc-800" />
            {connected ? (
              <>
                <Link href="/dashboard" className={`rounded-lg px-2 py-1.5 font-semibold text-zinc-900 dark:text-zinc-50`}>
                  Mon espace
                </Link>
                {current.profile.role === "VENDOR" && (
                  <Link href="/vendor" className={`rounded-lg px-2 py-1.5 ${LINK_CLASS}`}>
                    Espace vendeur
                  </Link>
                )}
                {current.profile.role === "ADMIN" && (
                  <Link href="/admin" className={`rounded-lg px-2 py-1.5 ${LINK_CLASS}`}>
                    Console admin
                  </Link>
                )}
                <form action={logoutAction} className="px-2 pt-1">
                  <button type="submit" className={LINK_CLASS}>
                    Déconnexion
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link href="/login" className={`rounded-lg px-2 py-1.5 ${LINK_CLASS}`}>
                  Connexion
                </Link>
                <Link
                  href="/register"
                  className="mt-1 rounded-lg bg-zinc-900 px-2 py-1.5 text-center text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
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
