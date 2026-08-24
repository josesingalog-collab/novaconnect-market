/** Formatage affichage d'un montant decimal string (D-001/D-016) — lecture seule. */
export function formatPrice(price: string, currency: string): string {
  const amount = Number(price);
  if (Number.isNaN(amount)) {
    return `${price} ${currency}`;
  }
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    currencyDisplay: "code",
  }).format(amount);
}
