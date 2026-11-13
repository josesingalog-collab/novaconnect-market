import { getCurrentProfile } from "@/lib/profile";
import { getVendorBalances, getVendorWithdrawals } from "@/services/vendor/finances";
import { FinancesClient } from "@/components/vendor/finances/finances-client";
import { Alert } from "@/components/ui/alert";
import Link from "next/link";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mes finances — SAVPAY",
  robots: { index: false, follow: false },
};

export default async function FinancesPage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    return (
      <div className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-4 lg:px-6 lg:py-5">
        <Alert variant="error" title="Authentification requise">
          Veuillez vous connecter pour accéder à vos finances.
        </Alert>
      </div>
    );
  }

  if (current.kind === "missing-profile") {
    return (
      <div className="mx-auto flex max-w-6xl flex-1 flex-col gap-6 px-4 py-4 lg:px-6 lg:py-5">
        <Alert variant="warning" title="Profil introuvable">
          Votre profil n&apos;a pas pu être chargé. Réessayez plus tard.
        </Alert>
      </div>
    );
  }

  let balances: Awaited<ReturnType<typeof getVendorBalances>> = [];
  let withdrawals: Awaited<ReturnType<typeof getVendorWithdrawals>> = [];
  let balancesError = false;
  let withdrawalsError = false;

  try {
    balances = await getVendorBalances();
  } catch {
    balancesError = true;
  }

  try {
    withdrawals = await getVendorWithdrawals();
  } catch {
    withdrawalsError = true;
  }

  const usdBalance = balances.find((b) => b.currency === "USD");

  return (
    <div className="mx-auto flex max-w-6xl flex-1 flex-col gap-8 px-4 py-4 lg:px-6 lg:py-5">
      <div>
        <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
          Paiements et retraits
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          Mes finances
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consultez vos soldes et suivez vos demandes de retrait.
        </p>
      </div>

      <FinancesClient
        balances={balances}
        balancesError={balancesError}
        withdrawals={withdrawals}
        withdrawalsError={withdrawalsError}
        usdBalance={usdBalance}
      />

      <Link
        href="/vendor"
        className="inline-block text-sm font-medium text-foreground underline-offset-4 hover:underline"
      >
        ← Retour à l&apos;espace vendeur
      </Link>
    </div>
  );
}
