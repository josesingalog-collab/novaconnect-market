"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarNavProps {
  collapsed?: boolean;
}

const NAV_ITEMS = [
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
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: "Produits",
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
    label: "Ventes",
    href: "/vendor/ventes",
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
          d="M3 20h18M5 20V10m5 10V4m5 16v-7m5 7V7"
        />
      </svg>
    ),
  },
  {
    label: "Finances",
    href: "/vendor/finances",
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
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    label: "Ajouter un produit",
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

export function SidebarNav({ collapsed }: SidebarNavProps) {
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
    if (href === "/vendor/ventes") return pathname === "/vendor/ventes";
    if (href === "/vendor/finances") return pathname === "/vendor/finances";
    return false;
  };

  return (
    <aside
      className={[
        "hidden bg-[#3537ba] text-white shadow-xl shadow-primary/20 lg:fixed lg:top-0 lg:left-0 lg:z-30 lg:flex lg:h-screen lg:w-60 lg:flex-col",
        collapsed ? "lg:w-16" : "lg:w-60",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Navigation vendeur"
    >
      <div className="flex h-20 items-center border-b border-white/10 px-5">
        {!collapsed ? (
          <span className="flex items-center gap-2.5 text-lg font-semibold tracking-tight text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm font-bold">
              N
            </span>
            SAVPAY
          </span>
        ) : (
          <span className="text-sm font-bold text-white" aria-label="SAVPAY">
            N
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-6" aria-label="Navigation principale">
        <ul className="flex flex-col gap-1 px-3" role="list">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={[
                    "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary focus-visible:outline-none",
                    active
                      ? "bg-white text-primary shadow-sm"
                      : "text-white/75 hover:bg-white/10 hover:text-white",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-current={active ? "page" : undefined}
                  aria-label={item.label}
                >
                  <span className="shrink-0" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      {!collapsed && (
        <div className="m-3 rounded-xl border border-white/15 bg-white/10 p-3 text-xs leading-5 text-white/75">
          Besoin d&apos;un nouveau produit ?
          <Link
            href="/vendor/catalogue/nouveau"
            className="mt-1 block font-semibold text-white hover:underline"
          >
            Commencer maintenant →
          </Link>
        </div>
      )}
    </aside>
  );
}
