/**
 * Système monétaire NovaConnect Market.
 *
 * INVARIANTS (§68 — intégrité financière) :
 *  1. AUCUN float JavaScript dans les calculs. Tous les montants manipulés en
 *     logique métier sont des `MinorAmount = bigint` (unités mineures).
 *  2. Représentation de stockage : colonnes PostgreSQL `numeric(18,2)`.
 *     - `numeric` est EXACT en base (pas de perte binaire).
 *     - PostgREST sérialise `numeric` en string JSON → aucun risque de perte
 *       de précision int8 > 2^53 côté client Supabase.
 *  3. Précision par devise (ISO 4217, documentée) :
 *     - USD : exponent 2 (cents)      — ex. 10,50 USD ⇒ minor 1050
 *     - CDF : exponent 2 (centimes)   — ex. 25000 CDF ⇒ minor 2500000
 *     Aucune conversion croisée USD↔CDF en V1 (taux de change inconnu — §60).
 *  4. Le parseur refuse toute entrée avec plus de décimales que l'exposant
 *     de la devise (pas d'arrondi silencieux d'argent saisi).
 *  5. Arrondi métier (commissions, remises) : demi-point supérieur ("half-up"),
 *     calculé en arithmétique entière via computeCommissionAmount().
 *
 * Capacité : le parseur accepte jusqu'à 15 chiffres entiers, marge de sécurité
 * sous la limite de numeric(18,2) (16 chiffres majeurs).
 */

export type CurrencyCode = "USD" | "CDF";

export interface CurrencyDefinition {
  readonly code: CurrencyCode;
  /** Nombre de décimales des unités mineures (ISO 4217). */
  readonly exponent: number;
  readonly symbol: string;
  readonly symbolPosition: "before" | "after";
}

export const CURRENCIES: Readonly<Record<CurrencyCode, CurrencyDefinition>> = {
  USD: { code: "USD", exponent: 2, symbol: "$", symbolPosition: "before" },
  CDF: { code: "CDF", exponent: 2, symbol: "FC", symbolPosition: "after" },
};

/** Montant en unités mineures (bigint). Format canonique de tout montant métier. */
export type MinorAmount = bigint;

export const ZERO_MINOR: MinorAmount = 0n;

/** Taux exprimé en points de base ×100 : 1 % = 100 bps, 100 % = 10000 bps. */
export const RATE_SCALE = 10_000n;

export class MoneyError extends Error {}

function assertKnownCurrency(code: string): asserts code is CurrencyCode {
  if (!(code in CURRENCIES)) {
    throw new MoneyError(
      `Devise non supportée : "${code}". Devises supportées : ${Object.keys(CURRENCIES).join(", ")}.`,
    );
  }
}

export function getCurrency(code: CurrencyCode): CurrencyDefinition {
  assertKnownCurrency(code);
  return CURRENCIES[code];
}

const AMOUNT_PATTERN_MAJOR_DIGITS = 15;

/**
 * Convertit une saisie utilisateur ou une valeur DB (`numeric` → string)
 * en unités mineures.
 *
 * Accepte : "10", "10.5", "10,50", "-3.99" et les numbers finis à notation
 * décimale simple. Refuse : notation scientifique, > décimales de la devise,
 * chaînes vides/garbage, séparateurs de milliers.
 */
export function parseAmountToMinor(
  input: string | number,
  currencyCode: CurrencyCode,
): MinorAmount {
  getCurrency(currencyCode);

  let value: string;
  if (typeof input === "number") {
    if (!Number.isFinite(input)) {
      throw new MoneyError(`Montant numérique invalide : ${String(input)}.`);
    }
    value = String(input);
    if (/e/i.test(value)) {
      throw new MoneyError(`Notation scientifique refusée pour un montant : "${value}".`);
    }
  } else {
    value = input.trim().replace(/,/g, ".");
    if (/e/i.test(value)) {
      throw new MoneyError(`Notation scientifique refusée pour un montant : "${value}".`);
    }
  }

  if (value.length === 0) {
    throw new MoneyError("Montant vide.");
  }

  const exponent = getCurrency(currencyCode).exponent;
  const pattern = new RegExp(`^-?\\d{1,${AMOUNT_PATTERN_MAJOR_DIGITS}}(\\.\\d{1,${exponent}})?$`);
  if (!pattern.test(value)) {
    throw new MoneyError(
      `Montant invalide : "${input}" (attendu : entier ou ${exponent} décimale(s) max, sans séparateurs de milliers).`,
    );
  }

  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [majorPart, fractionPart = ""] = unsigned.split(".");
  const major = majorPart ?? "0";
  const fraction = fractionPart.padEnd(exponent, "0");

  const combined = BigInt(`${negative ? "-" : ""}${major}${fraction}`);
  return combined as MinorAmount;
}

/**
 * Alias sémantique pour la lecture de colonnes PostgreSQL `numeric`
 * (sérialisées en string par PostgREST).
 */
export function decimalStringToMinor(value: string, currencyCode: CurrencyCode): MinorAmount {
  return parseAmountToMinor(value, currencyCode);
}

/**
 * Unités mineures → représentation décimale canonique (string), ex. :
 * 1234n + USD → "12.34" ; -5n + USD → "-0.05".
 * Utilisée pour écrire dans les colonnes numeric(18,2).
 */
export function minorToDecimalString(minor: MinorAmount, currencyCode: CurrencyCode): string {
  const exponent = getCurrency(currencyCode).exponent;
  const scale = 10n ** BigInt(exponent);
  const negative = minor < ZERO_MINOR;
  const abs = negative ? -minor : minor;
  const major = abs / scale;
  const fraction = (abs % scale).toString().padStart(exponent, "0");
  return `${negative ? "-" : ""}${major.toString()}.${fraction}`;
}

function groupThousands(integerDigits: string): string {
  let result = "";
  for (let i = 0; i < integerDigits.length; i += 1) {
    const remaining = integerDigits.length - i;
    result += integerDigits[i];
    if (remaining > 1 && (remaining - 1) % 3 === 0) {
      result += ",";
    }
  }
  return result;
}

export interface FormatOptions {
  /** Inclure le symbole devise (défaut : true). */
  readonly withSymbol?: boolean;
}

/**
 * Formatage DÉTERMINISTE sans float (groupage manuel) :
 * 1234567n + USD → "$12,345.67" ; 1234567n + CDF → "12,345.67 FC".
 * Le formatage est réservé à l'affichage — jamais aux calculs.
 */
export function formatMinorAmount(
  minor: MinorAmount,
  currencyCode: CurrencyCode,
  options: FormatOptions = {},
): string {
  const { withSymbol = true } = options;
  const currency = getCurrency(currencyCode);
  const decimal = minorToDecimalString(minor, currencyCode);
  const negative = decimal.startsWith("-");
  const [majorPart, fractionPart] = decimal.replace("-", "").split(".");
  const grouped = groupThousands(majorPart ?? "0");
  const body = `${grouped}.${fractionPart ?? ""}`;
  const sign = negative ? "-" : "";

  if (!withSymbol) {
    return `${sign}${body}`;
  }
  return currency.symbolPosition === "before"
    ? `${sign}${currency.symbol}${body}`
    : `${sign}${body} ${currency.symbol}`;
}

export function isPositive(minor: MinorAmount): boolean {
  return minor > ZERO_MINOR;
}

export function isNonNegative(minor: MinorAmount): boolean {
  return minor >= ZERO_MINOR;
}

export function addMinors(...values: readonly MinorAmount[]): MinorAmount {
  return values.reduce((total, value) => total + value, ZERO_MINOR);
}

export function subtractMinors(a: MinorAmount, b: MinorAmount): MinorAmount {
  return a - b;
}

/** Multiplication par une quantité entière sûre (lignes de commande). */
export function multiplyByQuantity(amount: MinorAmount, quantity: number): MinorAmount {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new MoneyError(
      `Quantité invalide : ${String(quantity)} (entier strictement positif requis).`,
    );
  }
  return amount * BigInt(quantity);
}

/**
 * Commission arrondie DEMI-POINT SUPÉRIEUR, en arithmétique entière :
 * commission = round_half_up(amount × rateBps / 10000).
 * Ex. : 10000n (100,00 $) × 1000n (10 %) → 1000n (10,00 $).
 */
export function computeCommissionAmount(amount: MinorAmount, rateBps: bigint): MinorAmount {
  if (!isNonNegative(amount)) {
    throw new MoneyError("Le montant soumis à commission doit être >= 0.");
  }
  if (rateBps < ZERO_MINOR || rateBps > RATE_SCALE) {
    throw new MoneyError(
      `Taux invalide : ${rateBps.toString()} bps (attendu 0..${RATE_SCALE.toString()}).`,
    );
  }
  const product = amount * rateBps;
  // Division bigint tronque vers zéro ; on décale de la moitié pour half-up (montants >= 0).
  return (product + RATE_SCALE / 2n) / RATE_SCALE;
}

/** Part vendeur après commission ; garantit commission ≤ montant. */
export function computeVendorAmount(amount: MinorAmount, commission: MinorAmount): MinorAmount {
  if (commission > amount) {
    throw new MoneyError("La commission ne peut pas excéder le montant.");
  }
  return amount - commission;
}
