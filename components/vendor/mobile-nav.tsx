"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const MOBILE_NAV_ITEMS = [
  {
    label: "Tableau de bord",
    href: "/vendor",
    icon: (
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
          strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1 m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: "Catalogue",
    href: "/vendor/catalogue",
    icon: (
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
          strokeWidth={1.5}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
  },
  {
    label: "Ajouter",
    href: "/vendor/catalogue/nouveau",
    icon: (
      <svg
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
];

export function MobileNav() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/vendor") return pathname === "/vendor";
    if (href === "/vendor/catalogue")
      return (
        pathname === "/vendor/catalogue" ||
        (pathname.startsWith("/vendor/catalogue/") &&
          !pathname.startsWith("/vendor/catalogue/nouveau"))
      );
    if (href === "/vendor/catalogue/nouveau") return pathname === "/vendor/catalogue/nouveau";
    return false;
  };

  return (
    <>
      <nav
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navigation mobile vendeur"
      >
        <div className="mx-auto max-w-6xl">
          <ul className="flex items-center justify-around py-1" role="list">
            {MOBILE_NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className={[
                      "flex min-h-[44px] min-w-[44px] flex-col items-center justify-center gap-0.5 rounded-lg px-3 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active ? "text-primary" : "text-muted-foreground",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    aria-current={active ? "page" : undefined}
                    aria-label={item.label}
                  >
                    <span className="h-5 w-5" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
      <div className="h-14 lg:hidden" aria-hidden="true" />
    </>
  );
}
