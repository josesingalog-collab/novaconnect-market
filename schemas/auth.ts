import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Adresse email invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(2, "Nom complet requis (2 caractères minimum)").max(80),
    email: z.email("Adresse email invalide"),
    password: z
      .string()
      .min(8, "Mot de passe : 8 caractères minimum")
      .max(72, "Mot de passe trop long (72 maximum)"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
