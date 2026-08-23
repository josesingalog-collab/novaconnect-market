import { z } from "zod";

export const profileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Nom complet requis (2 caractères minimum)")
    .max(80, "Nom complet trop long (80 maximum)"),
  phone: z
    .string()
    .trim()
    .max(30, "Numéro trop long (30 maximum)")
    .regex(/^\+?[0-9\s-]*$/, "Numéro de téléphone invalide (+, chiffres, espaces et tirets uniquement)")
    .transform((value) => (value.length === 0 ? null : value)),
  avatarUrl: z
    .union([z.literal(""), z.url("URL d'avatar invalide")])
    .transform((value) => (value === "" ? null : value)),
});

export type ProfileInput = z.infer<typeof profileSchema>;
