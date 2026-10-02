import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Inscription" }]} />
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            ← NovaConnect Market
          </Link>
          <p className="text-sm text-muted-foreground">
            Rejoignez NovaConnect pour acheter ou vendre des produits digitaux.
          </p>
        </div>
        <RegisterForm />
      </div>
    </main>
  );
}
