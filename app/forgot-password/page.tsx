import type { Metadata } from "next";
import Link from "next/link";
import { PasswordResetForm } from "@/components/auth/password-reset-form";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Réinitialiser le mot de passe",
  robots: { index: false, follow: false },
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const invalidOrExpiredLink = error === "invalid_or_expired_link";

  return (
    <main className="grid min-h-full flex-1 bg-background lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <Link href="/" className="text-xl font-semibold">
          SAVPAY
        </Link>
        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-[0.16em] text-white/70 uppercase">
            Sécurité du compte
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.05em]">
            Retrouvez l&apos;accès à votre espace.
          </h1>
          <p className="mt-6 text-base leading-7 text-white/75">
            Un lien sécurisé vous permettra de choisir un nouveau mot de passe.
          </p>
        </div>
        <p className="text-sm text-white/60">SAVPAY, la plateforme des créateurs.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← SAVPAY
          </Link>
          <div className="mt-10">
            {invalidOrExpiredLink && (
              <Alert variant="error" className="mb-5">
                Ce lien est invalide ou a expiré. Demandez un nouveau lien et utilisez uniquement le
                plus récent.
              </Alert>
            )}
            <PasswordResetForm />
          </div>
        </div>
      </section>
    </main>
  );
}
