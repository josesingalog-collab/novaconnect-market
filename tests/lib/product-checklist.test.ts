import { describe, expect, it } from "vitest";
import { checkProductCompletion } from "@/services/products/manage";
import type { SellerProduct } from "@/services/products/manage";

function makeProduct(overrides: Partial<SellerProduct> = {}): SellerProduct {
  return {
    id: "prod-1",
    title: "Mon Produit",
    slug: "mon-produit",
    status: "DRAFT",
    price: "10.00",
    currency: "USD",
    categoryId: "c0a1b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5",
    categoryName: null,
    thumbnailUrl: null,
    thumbnailPath: "cover.jpg",
    shortDescription: null,
    description: null,
    hasFile: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    productType: "PHYSICAL",
    ...overrides,
  };
}

const COMPLETE_CATEGORY_ID = "c0a1b2c3-d4e5-f6a7-b8c9-d0e1f2a3b4c5";

describe("checkProductCompletion", () => {
  it("produit complet → true", () => {
    const product = makeProduct({
      title: "TWINMOTION",
      price: "19.99",
      currency: "USD",
      categoryId: COMPLETE_CATEGORY_ID,
    });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit sans titre → false", () => {
    const product = makeProduct({ title: "" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec titre trop court (2 caractères) → false", () => {
    const product = makeProduct({ title: "AB" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec titre de 3 caractères → true", () => {
    const product = makeProduct({ title: "ABC" });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit sans catégorie (categoryId null) → false", () => {
    const product = makeProduct({ categoryId: null });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit sans catégorie (categoryId vide) → false", () => {
    const product = makeProduct({ categoryId: "" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit sans prix → false", () => {
    const product = makeProduct({ price: "" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec prix à 0 → false", () => {
    const product = makeProduct({ price: "0" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec prix '0.00' → false", () => {
    const product = makeProduct({ price: "0.00" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec prix négatif → false", () => {
    const product = makeProduct({ price: "-5.00" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit sans devise → false", () => {
    const product = makeProduct({ currency: "" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec devise invalide → false", () => {
    const product = makeProduct({ currency: "EUR" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec devise USD → true", () => {
    const product = makeProduct({ currency: "USD" });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit avec devise CDF → true", () => {
    const product = makeProduct({ currency: "CDF" });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit sans shortDescription → true (champ optionnel)", () => {
    const product = makeProduct({ shortDescription: null });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit sans description → true (champ optionnel)", () => {
    const product = makeProduct({ description: null });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit avec shortDescription vide → true (champ optionnel)", () => {
    const product = makeProduct({ shortDescription: "" });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit avec description vide → true (champ optionnel)", () => {
    const product = makeProduct({ description: "" });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("produit avec prix à décimales excessives → false", () => {
    const product = makeProduct({ price: "10.505" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("produit avec prix en notation scientifique → false", () => {
    const product = makeProduct({ price: "1e3" });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("SERVICE sans couverture ni fichier → true", () => {
    const product = makeProduct({ productType: "SERVICE", thumbnailPath: null, hasFile: false });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("SERVICE avec couverture → true", () => {
    const product = makeProduct({
      productType: "SERVICE",
      thumbnailPath: "cover.jpg",
      hasFile: false,
    });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("PHYSICAL avec couverture → true", () => {
    const product = makeProduct({
      productType: "PHYSICAL",
      thumbnailPath: "cover.jpg",
      hasFile: false,
    });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("PHYSICAL sans couverture → false", () => {
    const product = makeProduct({ productType: "PHYSICAL", thumbnailPath: null, hasFile: false });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("DIGITAL avec couverture et fichier → true", () => {
    const product = makeProduct({
      productType: "DIGITAL",
      thumbnailPath: "cover.jpg",
      hasFile: true,
    });
    expect(checkProductCompletion(product)).toBe(true);
  });

  it("DIGITAL sans couverture → false", () => {
    const product = makeProduct({ productType: "DIGITAL", thumbnailPath: null, hasFile: true });
    expect(checkProductCompletion(product)).toBe(false);
  });

  it("DIGITAL sans fichier → false", () => {
    const product = makeProduct({
      productType: "DIGITAL",
      thumbnailPath: "cover.jpg",
      hasFile: false,
    });
    expect(checkProductCompletion(product)).toBe(false);
  });
});
