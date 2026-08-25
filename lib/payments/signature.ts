/**
 * Signature HMAC-SHA256 des webhooks de paiement (Phase 7, §49/§50).
 *
 * Contrat :
 *  - l'émetteur signe le CORPS BRUT de la requête (raw body, octets exacts) ;
 *  - la signature hexadécimale transite dans l'en-tête `x-nc-signature` ;
 *  - la vérification est à temps constant : jamais de `===` sur les secrets,
 *    comparaison via les condensats SHA-256 (longueur fixe 32 octets) avec
 *    crypto.timingSafeEqual — insensible aux attaques temporelles et aux
 *    différences de longueur.
 */
import { createHmac, createHash, timingSafeEqual } from "node:crypto";

export const PAYMENT_SIGNATURE_HEADER = "x-nc-signature";

/** Signature hexadécimale du corps brut avec le secret partagé. */
export function createPaymentSignature(rawBody: string, secret: string): string {
  return createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
}

function sha256(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

/**
 * Vérifie la signature d'un webhook. Retourne `false` pour toute entrée
 * malformée (jamais d'exception) : le route doit répondre 401.
 */
export function verifyPaymentSignature(
  rawBody: string,
  secret: string,
  receivedSignature: string | null | undefined,
): boolean {
  if (typeof receivedSignature !== "string" || receivedSignature.length === 0) {
    return false;
  }
  const normalized = receivedSignature.trim().toLowerCase();
  const expected = createPaymentSignature(rawBody, secret);
  try {
    return timingSafeEqual(sha256(normalized), sha256(expected));
  } catch {
    return false;
  }
}

/** Condensat stable d'un événement brut — clé d'idempotence `payment_events`. */
export function deriveEventHash(rawBody: string): string {
  return createHash("sha256").update(rawBody, "utf8").digest("hex");
}
