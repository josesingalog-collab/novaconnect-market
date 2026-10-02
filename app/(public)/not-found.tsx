import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-24">
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Catalogue", href: "/catalogue" },
        ]}
      />
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
                strokeWidth={1.5}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </span>
          <h1 className="text-lg font-semibold text-foreground sm:text-xl">Page introuvable</h1>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground sm:text-base">
            Cette page n&apos;existe pas ou n&apos;est plus disponible.
          </p>
          <div className="mt-5 flex flex-col gap-3">
            <Link href="/" className="w-full">
              <Button size="lg" className="w-full">
                Retour à l&apos;accueil
              </Button>
            </Link>
            <Link href="/catalogue" className="w-full">
              <Button variant="outline" size="lg" className="w-full">
                Voir le catalogue
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
