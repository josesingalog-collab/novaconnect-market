/**
 * Validation centralisée des variables d'environnement (Zod).
 *
 * RÈGLE DE PROJET : tout autre module doit passer par ce fichier ou lib/config.ts.
 * L'accès direct à process.env est interdi ailleurs (règle ESLint dédiée).
 *
 * Les constantes RAW_* utilisent un accès LITTÉRAL à process.env : Next.js
 * remplace ces expressions à la compilation pour les bundles clients
 * (inlining des NEXT_PUBLIC_*), tout en gardant la validation Zod.
 */
import { z } from "zod";

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

const RAW_NEXT_PUBLIC_SUPABASE_URL = process.env["NEXT_PUBLIC_SUPABASE_URL"];
const RAW_NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env["NEXT_PUBLIC_SUPABASE_ANON_KEY"];
const RAW_NEXT_PUBLIC_APP_URL = process.env["NEXT_PUBLIC_APP_URL"];
const RAW_PAYMENT_PROVIDER = process.env["PAYMENT_PROVIDER"];
const RAW_PAYMENT_WEBHOOK_SECRET = process.env["PAYMENT_WEBHOOK_SECRET"];
const RAW_STORAGE_BUCKET_PRODUCT_FILES = process.env["STORAGE_BUCKET_PRODUCT_FILES"];
const RAW_STORAGE_BUCKET_VENDOR_LOGOS = process.env["STORAGE_BUCKET_VENDOR_LOGOS"];
const RAW_NODE_ENV = process.env["NODE_ENV"];

function formatEnvIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(racine)"}: ${issue.message}`)
    .join(" | ");
}

let cachedPublic: PublicEnv | null = null;

/** Variables publiques (sûres côté navigateur). Valide paresseusement, une seule fois. */
export function getPublicEnv(): PublicEnv {
  if (cachedPublic === null) {
    const parsed = publicEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: RAW_NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: RAW_NEXT_PUBLIC_SUPABASE_ANON_KEY,
    });
    if (!parsed.success) {
      throw new Error(
        `Variables d'environnement publiques invalides ou manquantes → ${formatEnvIssues(parsed.error)}. Copier .env.example vers .env.local.`,
      );
    }
    cachedPublic = parsed.data;
  }
  return cachedPublic;
}

let cachedServer: ServerEnv | null = null;

/** Variables serveur complètes (inclut SERVICE_ROLE — jamais exposée au client). */
export function getServerEnv(): ServerEnv {
  if (cachedServer === null) {
    const parsed = serverEnvSchema.safeParse({
      NEXT_PUBLIC_SUPABASE_URL: RAW_NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: RAW_NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env["SUPABASE_SERVICE_ROLE_KEY"],
    });
    if (!parsed.success) {
      throw new Error(
        `Variables d'environnement serveur invalides ou manquantes → ${formatEnvIssues(parsed.error)}.`,
      );
    }
    cachedServer = parsed.data;
  }
  return cachedServer;
}

export function getAppUrl(): string {
  return RAW_NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";
}

/**
 * Provider de paiement actif. En V1, seul "mock" est autorisé :
 * aucune intégration réelle n'est simulée avant le choix officiel du prestataire.
 */
export type PaymentProviderId = "mock";

export function getPaymentProviderId(): PaymentProviderId {
  const value = RAW_PAYMENT_PROVIDER?.trim() || "mock";
  if (value !== "mock") {
    throw new Error(`PAYMENT_PROVIDER="${value}" non supporté en V1. Valeurs autorisées : "mock".`);
  }
  return "mock";
}

/** Le provider mock ne doit jamais créditer une commande en production. */
export function canSimulatePayments(): boolean {
  return RAW_NODE_ENV !== "production";
}

/** Secret de signature webhook (requis pour valider l'authenticité des webhooks). */
export function getPaymentWebhookSecret(): string | null {
  const value = RAW_PAYMENT_WEBHOOK_SECRET?.trim();
  return value && value.length > 0 ? value : null;
}

export function getStorageBucketProductFiles(): string {
  return RAW_STORAGE_BUCKET_PRODUCT_FILES?.trim() || "product-files";
}

export function getStorageBucketVendorLogos(): string {
  return RAW_STORAGE_BUCKET_VENDOR_LOGOS?.trim() || "vendor-logos";
}
