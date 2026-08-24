/**
 * Transforme un libellé en slug URL : minuscules, sans accents,
 * séparateur "-", tronqué à 60 caractères. Ex. "Ébooks & Templates"
 * → "ebooks-templates".
 */
export function slugifyFr(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}
