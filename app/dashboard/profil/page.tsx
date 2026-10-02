import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { ProfileForm } from "@/components/profile/profile-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { Alert } from "@/components/ui/alert";
import { getCurrentProfile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Mon profil",
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<string, string> = {
  BUYER: "Acheteur",
  VENDOR: "Vendeur",
  ADMIN: "Administrateur",
};

export default async function ProfilePage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/dashboard/profil");
  }

  if (current.kind === "missing-profile") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Mon profil" }]} />
        <Alert variant="error" title="Profil introuvable">
          Si vous venez de créer votre compte, réessayez dans un instant.
        </Alert>
      </main>
    );
  }

  const { profile } = current;

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-12 sm:px-6 lg:px-8">
      <div>
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Mon profil" }]} />
        <p className="mt-2 text-sm text-muted-foreground">
          Consultez et modifiez vos informations personnelles.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Modifier mes informations
        </h1>
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
          Photo de profil
        </h2>
        <AvatarUpload currentUrl={profile.avatarUrl} />
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <ProfileForm profile={profile} />
      </section>

      <section className="rounded-xl border border-border bg-card p-6">
        <dl className="flex flex-wrap gap-x-10 gap-y-2">
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Email (non modifiable ici)</dt>
            <dd className="mt-0.5 font-medium text-foreground">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground uppercase">Rôle</dt>
            <dd className="mt-0.5 font-medium text-foreground">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          Le rôle et le statut du compte sont gérés par la plateforme — ils ne sont pas modifiables
          depuis ce formulaire (garde PostgreSQL active).
        </p>
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
