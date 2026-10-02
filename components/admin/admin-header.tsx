"use client";

/* eslint-disable @next/next/no-img-element -- L'avatar est fourni par le stockage Supabase. */

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { UserProfile } from "@/lib/profile";
import { Button } from "@/components/ui/button";

export function AdminHeader({ profile }: { profile: UserProfile | null }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="w-full lg:ml-60 lg:pl-6">
      <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-sm lg:px-6">
        <div className="flex items-center gap-3">
          <details
            className="lg:hidden"
            open={menuOpen}
            onToggle={(e) => setMenuOpen((e.target as HTMLDetailsElement).open)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setMenuOpen(false);
            }}
          >
            <summary
              aria-label="Ouvrir le menu de navigation"
              aria-expanded={menuOpen}
              className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-lg border border-border text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&::-webkit-details-marker]:hidden"
            >
              <svg
                className="h-4 w-4"
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
            <div className="absolute top-14 left-0 w-56 max-w-[calc(100vw-2rem)] flex-col gap-1 rounded-xl border border-border bg-background p-2 shadow-lg">
              <Link
                href="/admin"
                className="flex min-h-[44px] items-center rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                Produits à vérifier
              </Link>
              <hr className="my-1 border-border" />
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex min-h-[44px] w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  Déconnexion
                </button>
              </form>
            </div>
          </details>
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            NC
          </span>
          <span className="hidden text-xs font-medium tracking-widest text-muted-foreground uppercase lg:block">
            Administration
          </span>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          {profile && (
            <>
              <div className="hidden items-center gap-2 lg:flex">
                {profile.avatarUrl ? (
                  <img
                    src={profile.avatarUrl}
                    alt={profile.fullName}
                    className="h-8 w-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {profile.fullName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">{profile.fullName}</p>
                  <p className="text-xs text-muted-foreground">{profile.email}</p>
                </div>
              </div>
              <form action={logoutAction}>
                <Button variant="outline" size="sm" type="submit" className="hidden lg:inline-flex">
                  Déconnexion
                </Button>
              </form>
              <Link href="/dashboard">
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  aria-label="Retour à l'accueil"
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
                      d="M15.75 19.5L8.25 12l7.5-7.5"
                    />
                  </svg>
                </Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
