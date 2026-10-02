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
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <Breadcrumb items={[{ label: "Accueil", href: "/" }]} />
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
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            Une erreur est survenue
          </h1>
          <p className="text-lg text-muted-foreground">
            Nous n&apos;avons pas pu charger cette page. Veuillez réessayer.
          </p>
          <div className="flex flex-col gap-3">
            <Button onClick={() => reset()} size="lg">
              Réessayer
            </Button>
            <Link
              href="/"
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Retour à l&apos;accueil
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
