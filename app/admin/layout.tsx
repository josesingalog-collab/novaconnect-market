import type { ReactNode } from "react";
import { requireRole } from "@/lib/guards";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireRole("ADMIN", "/admin");

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-12">
      <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
        NovaConnect Market · Espace administrateur
      </p>
      {children}
    </main>
  );
}
