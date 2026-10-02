import { z } from "zod";

export const vendorUpdateSchema = z
  .object({
    storeName: z
      .string()
      .trim()
      .min(3, "Nom de boutique : 3 caractères minimum")
      .max(60, "Nom de boutique : 60 caractères maximum"),
    description: z
      .string()
      .trim()
      .max(500, "Description : 500 caractères maximum")
      .optional()
      .transform((value) => (value !== undefined && value.length > 0 ? value : null)),
  })
  .strict();

export type VendorUpdateInput = z.infer<typeof vendorUpdateSchema>;
