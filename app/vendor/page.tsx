import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Espace vendeur",
  robots: { index: false, follow: false },
};

type VendorStatus = "PENDING" | "ACTIVE" | "REJECTED" | "SUSPENDED";

interface VendorRow {
  id: string;
  store_name: string;
  slug: string;
  description: string | null;
  status: VendorStatus;
  created_at: string;
}

const STATUS_BADGES: Record<VendorStatus, { label: string; className: string }> = {
  PENDING: {
    label: "En attente de validation",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
  },
  ACTIVE: {
    label: "Active",
    className:
      "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  REJECTED: {
    label: "Refusée",
    className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
  SUSPENDED: {
    label: "Suspendue",
    className: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  },
};

function StatusBanner({ status, slug }: { status: VendorStatus; slug: string }) {
  switch (status) {
    case "PENDING":
      return (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
          Ta boutique est <strong>en attente de validation</strong>. Elle ne sera visible
          publiquement qu&apos;après validation par un administrateur. Tu peux préparer tes
          produits en attendant.
        </div>
      );
    case "ACTIVE":
      return (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          🎉 Ta boutique est <strong>active</strong> et visible publiquement :{" "}
          <Link href={`/boutique/${encodeURIComponent(slug)}`} className="font-medium underline underline-offset-4">
            voir ma page publique
          </Link>
          .
        </div>
      );
    case "REJECTED":
      return (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Ta demande de boutique a été <strong>refusée</strong> par l&apos;administration.
          Contacte-nous à{" "}
          <a href="mailto:contact@novaconnect.market" className="font-medium underline underline-offset-4">
            contact@novaconnect.market
          </a>{" "}
          pour en connaître les raisons avant de soumettre une nouvelle demande.
        </div>
      );
    case "SUSPENDED":
      return (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Ta boutique est <strong>suspendue</strong> par l&apos;administration : elle n&apos;apparaît
          plus dans le catalogue public. Écris à{" "}
          <a href="mailto:contact@novaconnect.market" className="font-medium underline underline-offset-4">
            contact@novaconnect.market
          </a>{" "}
          pour régulariser la situation.
        </div>
      );
  }
}

function EmptyShopState() {
  return (
    <>
      <section className="rounded-xl border border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
        <p aria-hidden className="text-3xl">🏪</p>
        <h2 className="mt-3 text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Tu n&apos;as pas encore de boutique
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Crée ta boutique en quelques minutes : ton profil devient vendeur
          automatiquement, sans nouvelle inscription.
        </p>
        <Link
          href="/dashboard/devenir-vendeur"
          className="mt-5 inline-block rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          ✨ Devenir vendeur
        </Link>
      </section>
      <Link href="/dashboard" className="inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
        ← Retour au tableau de bord
      </Link>
    </>
  );
}

export default async function VendorPage({
  searchParams,
}: {
  searchParams: Promise<{ bienvenue?: string }>;
}) {
  const { bienvenue } = await searchParams;
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/vendor");
  }

  if (current.kind === "missing-profile") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Profil introuvable. Déconnecte-toi puis reconnecte-toi pour réessayer.
        </div>
      </main>
    );
  }

  const isAdmin = current.profile.role === "ADMIN";
  const supabase = await createSupabaseServerClient();

  // Lecture via les policies RLS vendeurs : un vendeur ne voit que SA boutique,
  // et aucun chemin d'écriture n'expose le statut (réservé à l'administration).
  let shop: VendorRow | null = null;
  if (!isAdmin) {
    const { data } = await supabase
      .from("vendors")
      .select("id, store_name, slug, description, status, created_at")
      .eq("user_id", current.profile.id)
      .maybeSingle();
    shop = (data as VendorRow | null) ?? null;
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-12">
      <div>
        <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
          NovaConnect Market · Vendeurs
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Espace vendeur
        </h1>
      </div>

      {bienvenue === undefined ? null : (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          🎉 Boutique créée ! Ton profil est maintenant « Vendeur ». Elle est en attente de
          validation par un administrateur avant d&apos;être visible publiquement.
        </div>
      )}

      {isAdmin ? (
        <section className="rounded-xl border border-zinc-200 bg-white p-6 text-sm leading-6 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          Les administrateurs gèrent les validations depuis la{" "}
          <Link href="/admin" className="font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
            console admin
          </Link>
          ; cette espace concerne les boutiques des vendeurs.
        </section>
      ) : shop === null ? (
        <EmptyShopState />
      ) : (
        <>
          <StatusBanner status={shop.status} slug={shop.slug} />

          <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
                Ma boutique
              </h2>
              <span
                className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_BADGES[shop.status].className}`}
              >
                {STATUS_BADGES[shop.status].label}
              </span>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Nom</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{shop.store_name}</dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Adresse publique</dt>
                <dd className="text-sm font-medium break-all text-zinc-900 dark:text-zinc-100">
                  /boutique/{shop.slug}
                </dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Créée le</dt>
                <dd className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {new Date(shop.created_at).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </dd>
              </div>
              <div className="flex justify-between gap-4 sm:block">
                <dt className="text-sm text-zinc-500 dark:text-zinc-400">Description</dt>
                <dd className="max-w-md text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {shop.description !== null && shop.description.length > 0
                    ? shop.description
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-xl border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
            <p className="font-medium text-zinc-800 dark:text-zinc-200">Gestion du catalogue</p>
            <p className="mt-2">
              La publication de produits arrive à l&apos;étape suivante. Cette page est
              volontairement minimale.
            </p>
          </section>

          <Link href="/dashboard" className="inline-block font-medium text-zinc-900 underline-offset-4 hover:underline dark:text-zinc-100">
            ← Retour au tableau de bord
          </Link>
        </>
      )}
    </main>
  );
}
