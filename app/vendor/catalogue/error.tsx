"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:px-6 lg:py-8">
      <Breadcrumb items={[{ label: "Tableau de bord", href: "/vendor" }, { label: "Catalogue" }]} />

      <Card variant="bordered" className="overflow-hidden">
        <CardContent
          className="flex flex-col items-center justify-center p-6 text-center sm:p-8"
          role="status"
        >
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-muted text-3xl sm:h-16 sm:w-16"
            aria-hidden="true"
          >
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </span>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Impossible de charger votre catalogue
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Une erreur s&apos;est produite lors du chargement de vos produits. Veuillez réessayer.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button onClick={() => reset()} size="lg" className="min-h-[48px]">
              Réessayer
            </Button>
            <Link
              href="/vendor"
              className="border-input inline-flex min-h-[48px] items-center justify-center rounded-lg border bg-background px-6 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Retour au tableau de bord
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
