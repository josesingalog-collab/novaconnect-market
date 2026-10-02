import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PasswordChangeForm } from "@/components/profile/password-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div>
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Sécurité" }]} />
        <p className="mt-2 text-sm text-muted-foreground">
          Changer votre mot de passe pour protéger votre compte.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Changer mon mot de passe
        </h1>
        <PasswordChangeForm />
      </section>

      <Link
        href="/dashboard"
        className="inline-block font-medium text-foreground underline-offset-4 hover:underline"
      >
        ← Retour au tableau de bord
      </Link>
    </main>
  );
}
