/**
 * Abstraction des fournisseurs de paiement (§22).
 *
 * AUCUNE intégration réelle (M-Pesa, Orange Money, Airtel Money, agrégateurs)
 * n'est implémentée en V1 : le prestataire n'a pas encore été choisi.
 * Seul le MockPaymentProvider existe (Phase 7) pour tester :
 * SUCCESS, FAILED, PENDING, DUPLICATED_WEBHOOK, INVALID_AMOUNT, INVALID_SIGNATURE.
 *
 * L'intégration réelle consistera à ajouter un fichier
 * `services/payments/providers/<provider>.ts` implémentant cette interface,
 * sans modifier le reste du système (webhook, commandes, ledger).
 */
import type { CurrencyCode } from "@/lib/money";

export type { PaymentProviderId } from "@/lib/env";

/** Statut vu par le provider — jamais considéré comme PAID sans confirmation webhook. */
export type ProviderPaymentStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

export interface PayerInfo {
  readonly email?: string;
  readonly phone?: string;
  readonly fullName?: string;
}

export interface CreatePaymentInput {
  /** Référence interne unique du paiement (idempotence côté provider). */
  readonly reference: string;
  readonly orderNumber: string;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly payer: PayerInfo;
  /** URL de retour client après paiement (affichage uniquement — pas une preuve). */
  readonly returnUrl: string;
  readonly cancelUrl: string;
}

export interface CreatePaymentResult {
  readonly providerReference: string;
  /** URL d'initiation/redirect si le provider en expose une. */
  readonly redirectUrl?: string;
  readonly status: ProviderPaymentStatus;
}

export interface VerifyPaymentInput {
  readonly providerReference: string;
}

export interface VerifyPaymentResult {
  readonly status: ProviderPaymentStatus;
  /** Montant confirmé par le provider — à comparer avec le paiement interne (§23-5). */
  readonly amountMinor?: bigint;
  readonly currency?: CurrencyCode;
  readonly raw?: unknown;
}

export interface WebhookEnvelope {
  /** Référence provider permettant de retrouver le paiement interne. */
  readonly providerReference: string;
  readonly eventType: string;
  readonly amountMinor?: bigint;
  readonly currency?: CurrencyCode;
  /** Empreinte stable de l'événement (détection de doublons §23-4). */
  readonly eventId: string;
  readonly signatureValid: boolean;
  readonly rawPayload: unknown;
}

export interface RefundInput {
  readonly providerReference: string;
  readonly amountMinor: bigint;
  readonly currency: CurrencyCode;
  readonly reason: string;
}

/**
 * Contrat que tout fournisseur de paiement doit implémenter.
 * Le flux métier (services/orders, webhook) ne dépend QUE de cette interface.
 */
export interface PaymentProvider {
  readonly id: string;

  /** Initie un paiement et renvoie la référence provider + éventuelle URL. */
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  /**
   * Vérification active auprès du provider (source secondaire après le webhook).
   * Utilisée pour le rattrapage des paiements PENDING expirés.
   */
  verifyPayment(input: VerifyPaymentInput): Promise<VerifyPaymentResult>;

  /**
   * Valide l'authenticité du webhook (signature/HMAC selon provider).
   * Doit être appelée AVANT tout traitement (§23-2).
   */
  verifyWebhookSignature(rawBody: string, headers: Readonly<Record<string, string>>): boolean;

  /** Transforme un payload webhook validé en enveloppe normalisée. */
  parseWebhook(rawBody: string): WebhookEnvelope;

  /** Optionnel en V1 : remboursement complet/partiel. */
  refundPayment?(input: RefundInput): Promise<{ refunded: boolean; raw?: unknown }>;
}
