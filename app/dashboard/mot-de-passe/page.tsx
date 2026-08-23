import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordChangeForm } from "@/components/profile/password-form";
import { getCurrentProfile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Changer mon mot de passe",
  robots: { index: false, follow: false },
};

export default async function PasswordPage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/mot-de-passe");
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
          NovaConnect Market · Sécurité
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Changer mon mot de passe
        </h1>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <PasswordChangeForm />
      </section>

      <Link href="/dashboard" className="inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
        ← Retour au tableau de bord
      </Link>
    </main>
  );
}
