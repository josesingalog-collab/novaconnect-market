import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TwoFactorPanel } from "@/components/auth/two-factor-panel";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { safeInternalPath } from "@/lib/navigation";

export const metadata: Metadata = {
  title: "Vérification en deux étapes",
  robots: { index: false, follow: false },
};

export default async function TwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; setup?: string }>;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/auth/two-factor");

  const params = await searchParams;
  const nextPath = safeInternalPath(params.next);

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-[#f8fbff] px-4 py-12 sm:px-6">
      <TwoFactorPanel nextPath={nextPath} setup={params.setup === "1"} />
    </main>
  );
}
