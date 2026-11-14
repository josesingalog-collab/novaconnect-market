import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Créer un compte",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user !== null) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-full flex-1 bg-background lg:grid-cols-2">
      <section className="hidden flex-col justify-between bg-primary p-12 text-white lg:flex">
        <Link href="/" className="text-xl font-semibold">
          SAVPAY
        </Link>
        <div className="max-w-md">
          <p className="text-sm font-semibold tracking-[0.16em] text-white/70 uppercase">
            SAVPAY
          </p>
          <h1 className="mt-4 text-5xl font-semibold tracking-[-0.05em]">
            Valorisez vos produits numériques.
          </h1>
          <p className="mt-6 text-base leading-7 text-white/75">
            Créez votre espace pour acheter, vendre et développer votre activité en ligne.
          </p>
        </div>
        <p className="text-sm text-white/60">Simple, rapide et sécurisé.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← SAVPAY
          </Link>
          <p className="mt-10 text-sm text-muted-foreground">Créez votre compte gratuitement.</p>
          <RegisterForm />
        </div>
      </section>
    </main>
  );
}
