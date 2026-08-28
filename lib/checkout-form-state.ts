/**
 * État du formulaire de checkout — module NEUTRE partagé.
 *
 * Next.js 16 : un fichier "use server" ne peut exporter QUE des fonctions
 * async (les types sont effacés, pas les valeurs). L'état initial vit donc
 * ici et est consommé par le client (`checkout-view`) comme par l'action
 * serveur, garantissant l'unicité de la forme de l'état.
 */
import type { CheckoutOrder } from "@/services/orders/checkout";

export interface CheckoutFormState {
  status: "idle" | "error" | "success";
  error: string | null;
  /** Rempli uniquement quand status === "success" (montants serveur). */
  order: CheckoutOrder | null;
}

export const initialCheckoutState: CheckoutFormState = {
  status: "idle",
  error: null,
  order: null,
};
