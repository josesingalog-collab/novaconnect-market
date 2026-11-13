import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { Breadcrumb } from "@/components/ui/breadcrumb";
import { getCurrentProfile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Panier",
};

export default async function CartPage() {
  const current = await getCurrentProfile();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <Breadcrumb items={[{ label: "Accueil", href: "/" }, { label: "Panier" }]} />
      <div>
        <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
          SAVPAY · Panier
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Votre panier</h1>
      </div>

      <CartView authenticated={current.kind === "ok"} />
    </main>
  );
}
