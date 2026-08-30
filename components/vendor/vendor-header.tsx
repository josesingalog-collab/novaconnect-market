import Link from "next/link";
import { Button } from "@/components/ui/button";

export function VendorHeader() {
  return (
    <header className="lg:ml-60 lg:pl-6">
      <div className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm px-4 lg:px-6">
        <span className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          Espace vendeur
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">Espace personnel</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/">Accueil</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}