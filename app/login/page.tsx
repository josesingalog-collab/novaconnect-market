import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Connexion",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user !== null) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const nextPath =
    typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/dashboard";

  return (
    <main className="grid min-h-full flex-1 bg-white lg:grid-cols-2">
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
            Achetez, vendez et gérez vos ressources depuis un espace sécurisé.
          </p>
        </div>
        <p className="text-sm text-white/60">SAVPAY, la plateforme des créateurs.</p>
      </section>
      <section className="flex items-center justify-center px-5 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link href="/" className="text-sm font-semibold text-primary hover:underline">
            ← SAVPAY
          </Link>
          <p className="mt-10 text-sm text-muted-foreground">Ravi de vous revoir.</p>
          <LoginForm nextPath={nextPath} />
        </div>
      </section>
    </main>
  );
}
