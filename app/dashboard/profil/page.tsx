import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AvatarUpload } from "@/components/profile/avatar-upload";
import { ProfileForm } from "@/components/profile/profile-form";
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
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
        Profil introuvable. Si tu viens de créer le compte, réessaie dans un instant.
      </div>
    );
  }

  const { profile } = current;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
          NovaConnect Market · Mon profil
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Modifier mes informations
        </h1>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
          Photo de profil
        </h2>
        <AvatarUpload currentUrl={profile.avatarUrl} />
      </section>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <ProfileForm profile={profile} />
      </section>

      <section className="rounded-xl border border-dashed border-zinc-300 p-5 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        <dl className="flex flex-wrap gap-x-10 gap-y-2">
          <div>
            <dt className="text-xs uppercase">Email (non modifiable ici)</dt>
            <dd className="mt-0.5 font-medium text-zinc-800 dark:text-zinc-200">{profile.email}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase">Rôle</dt>
            <dd className="mt-0.5 font-medium text-zinc-800 dark:text-zinc-200">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs">
          Le rôle et le statut du compte sont gérés par la plateforme — ils ne sont pas modifiables depuis ce formulaire
          (garde PostgreSQL active).
        </p>
      </section>

      <Link href="/dashboard" className="inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
        ← Retour au tableau de bord
      </Link>
    </main>
  );
}
