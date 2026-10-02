import { parseAmountToMinor, formatMinorAmount, type CurrencyCode } from "@/lib/money";

/** Formatage affichage d'un montant decimal string (D-001/D-016) — lecture seule. */
export function formatPrice(price: string, currency: string): string {
  try {
    const minor = parseAmountToMinor(price, currency as CurrencyCode);
    return formatMinorAmount(minor, currency as CurrencyCode);
  } catch {
    return `${price} ${currency}`;
  }
}
