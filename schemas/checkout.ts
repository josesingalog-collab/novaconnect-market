import { z } from "zod";

/**
 * Payload du checkout : UNIQUEMENT les identifiants produits choisis.
 * Aucun prix, total, commission ou buyer_id ne transite par le client —
 * la RPC create_checkout_order (Phase 6-S3) relit tout depuis la base.
 */
export const checkoutSchema = z.object({
  productIds: z
    .array(z.string().uuid("Identifiant de produit invalide"))
    .min(1, "Ton panier est vide")
    .max(50, "Trop d'articles dans une commande (50 maximum)"),
});

export type CheckoutInput = z.infer<typeof checkoutSchema>;
