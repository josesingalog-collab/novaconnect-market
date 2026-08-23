import { z } from "zod";

export const passwordChangeSchema = z
  .object({
    newPassword: z
      .string()
      .min(8, "Mot de passe : 8 caractères minimum")
      .max(72, "Mot de passe trop long (72 maximum)"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Les mots de passe ne correspondent pas",
    path: ["confirmPassword"],
  });

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
