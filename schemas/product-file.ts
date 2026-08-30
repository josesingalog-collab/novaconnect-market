import { z } from "zod";

export const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const productFileSchema = z.object({
  productId: z.string().uuid("Produit invalide"),
});

export type ProductFileInput = z.infer<typeof productFileSchema>;
export type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];