import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { getCurrentProfile } from "@/lib/profile";
import { canSimulatePayments } from "@/lib/env";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const current = await getCurrentProfile();

  if (current.kind === "unauthenticated") {
    redirect("/login?next=/checkout");
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Breadcrumb
        items={[
          { label: "Accueil", href: "/" },
          { label: "Panier", href: "/panier" },
          { label: "Commande" },
        ]}
      />
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          SAVPAY · Commande
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
          Finaliser votre commande
        </h1>
      </div>

      <CheckoutView
        authenticated={current.kind === "ok"}
        mockPaymentEnabled={canSimulatePayments()}
        customer={
          current.kind === "ok"
            ? {
                fullName: current.profile.fullName,
                email: current.profile.email,
                phone: current.profile.phone,
              }
            : null
        }
      />
    </main>
  );
}
