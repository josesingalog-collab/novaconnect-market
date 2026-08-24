import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";
import { getCurrentProfile } from "@/lib/profile";

export const metadata: Metadata = {
  title: "Mon panier",
};

export default async function CartPage() {
  const current = await getCurrentProfile();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-10 sm:px-6">
      <div>
        <p className="text-xs font-medium tracking-widest text-zinc-500 uppercase dark:text-zinc-400">
          NovaConnect Market · Panier
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Mon panier
        </h1>
      </div>

      <CartView authenticated={current.kind === "ok"} />
    </main>
  );
}
