import { z } from "zod";

export const MAX_COVER_SIZE = 5 * 1024 * 1024;

export const ALLOWED_COVER_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const productFormSchema = z.object({
  title: z
    .string()
    .min(3, "Le titre doit comporter au moins 3 caractères")
    .max(150, "Le titre ne doit pas dépasser 150 caractères"),
  shortDescription: z
    .string()
    .max(300, "La description courte ne doit pas dépasser 300 caractères")
    .optional(),
  description: z
    .string()
    .max(5000, "La description ne doit pas dépasser 5000 caractères")
    .optional(),
  price: z.string().min(1, "Le prix est requis").regex(/^\d{1,16}(\.\d{1,2})?$/, "Format de prix invalide"),
  currency: z.enum(["USD", "CDF"], { message: "Devise invalide" }),
  categoryId: z.string().uuid("Catégorie invalide"),
  thumbnailUrl: z
    .string()
    .url("URL de vignette invalide")
    .optional(),
  thumbnailPath: z.string().optional(),
});

export type ProductFormInput = z.infer<typeof productFormSchema>;