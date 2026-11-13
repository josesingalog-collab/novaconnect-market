/**
 * Configuration centrale SAVPAY (§47).
 * Aucune valeur métier configurable ne doit être dispersée dans le code.
 *
 * NOTE V1 : ces constantes sont les valeurs par défaut de démarrage.
 * Les valeurs pilotables à chaud par l'admin vivront dans la table
 * `app_settings` (Phase 2+) et seront lues via un service dédié — ce module
 * reste la source des défauts et des limites non négociables.
 */
import type { CurrencyCode } from "@/lib/money";

export const APP_NAME = "SAVPAY" as const;
export const APP_DESCRIPTION =
  "Marketplace de produits numériques pour les créateurs d'Afrique francophone : e-books, formations, templates, fichiers CAD/BIM, scripts et ressources professionnelles." as const;

// --- Devises ---
export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = ["USD", "CDF"];
export const DEFAULT_CURRENCY: CurrencyCode = "USD";
// Pas de conversion croisée USD↔CDF en V1 : taux de change non fourni (§60).

// --- Commission ---
/** Taux global par défaut : 10 % = 1 000 bps. Snapshot obligatoire dans order_items. */
export const DEFAULT_COMMISSION_RATE_BPS = 1_000n;

// --- Retraits ---
/**
 * Seuil minimum de retrait PAR devise, en unités mineures.
 * Une devise absente ⇒ retraits désactivés pour cette devise
 * (on n'invente pas de taux CDF — §60). Configurable via app_settings plus tard.
 */
export const MIN_WITHDRAWAL_MINOR: Partial<Record<CurrencyCode, bigint>> = {
  USD: 2_000n, // 20,00 USD
};

export function getMinWithdrawalMinor(currency: CurrencyCode): bigint | null {
  return MIN_WITHDRAWAL_MINOR[currency] ?? null;
}

// --- Uploads (§30) ---
export const PRODUCT_FILE_MAX_BYTES = 200 * 1024 * 1024; // 200 Mo
export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024; // 5 Mo

export const ALLOWED_PRODUCT_FILE_EXTENSIONS = [
  ".pdf",
  ".epub",
  ".zip",
  ".mp4",
  ".mov",
  ".dwg",
  ".rvt",
  ".ifc",
  ".skp",
  ".psd",
  ".ai",
  ".xlsx",
  ".docx",
  ".pptx",
] as const;

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

// --- Livraison numérique (§14/§15) ---
export const DOWNLOAD_LINK_TTL_SECONDS = 60;
/** Limite globale de téléchargements par fichier acheté (null = illimité en V1). */
export const DOWNLOAD_LIMIT_PER_FILE: number | null = null;

// --- Stockage ---
export const STORAGE_BUCKETS = {
  productFiles: "product-files", // bucket PRIVÉ — jamais public
} as const;

// --- Commandes ---
export const ORDER_NUMBER_PREFIX = "NC";

// --- Catalogue ---
export const PRODUCTS_PAGE_SIZE = 24;
