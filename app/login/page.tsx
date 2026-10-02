import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { Breadcrumb } from "@/components/ui/breadcrumb";
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
    <main className="flex min-h-full flex-1 items-center justify-center px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-md flex-col gap-6">
        <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Connexion" }]} />
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
          >
            ← NovaConnect Market
          </Link>
          <p className="text-sm text-muted-foreground">
            Bienvenue sur NovaConnect. Connectez-vous pour accéder à votre espace.
          </p>
        </div>
        <LoginForm nextPath={nextPath} />
      </div>
    </main>
  );
}
