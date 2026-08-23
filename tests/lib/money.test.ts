import { describe, expect, it } from "vitest";
import {
  MoneyError,
  addMinors,
  computeCommissionAmount,
  computeVendorAmount,
  decimalStringToMinor,
  formatMinorAmount,
  isPositive,
  minorToDecimalString,
  multiplyByQuantity,
  parseAmountToMinor,
  subtractMinors,
} from "@/lib/money";

describe("parseAmountToMinor", () => {
  it("convertit les valeurs simples USD (exponent 2)", () => {
    expect(parseAmountToMinor("10", "USD")).toBe(1000n);
    expect(parseAmountToMinor("10.5", "USD")).toBe(1050n);
    expect(parseAmountToMinor("10.50", "USD")).toBe(1050n);
    expect(parseAmountToMinor("0.01", "USD")).toBe(1n);
  });

  it("accepte la virgule décimale (saisie franco)", () => {
    expect(parseAmountToMinor("12,50", "USD")).toBe(1250n);
    expect(parseAmountToMinor("25000,99", "CDF")).toBe(2500099n);
  });

  it("gère les grands montants CDF sans perte de précision", () => {
    expect(parseAmountToMinor("2500000", "CDF")).toBe(250000000n);
    expect(parseAmountToMinor("999999999999999", "USD")).toBe(99999999999999900n);
  });

  it("accepte un number fini en notation décimale simple", () => {
    expect(parseAmountToMinor(19.99, "USD")).toBe(1999n);
    expect(parseAmountToMinor(50, "CDF")).toBe(5000n);
  });

  it("accepte un signe négatif (écritures de ledger)", () => {
    expect(parseAmountToMinor("-5.00", "USD")).toBe(-500n);
  });

  it("refuse plus de décimales que l'exposant de la devise", () => {
    expect(() => parseAmountToMinor("10.505", "USD")).toThrow(MoneyError);
    expect(() => parseAmountToMinor("10.505", "CDF")).toThrow(MoneyError);
  });

  it("refuse la notation scientifique", () => {
    expect(() => parseAmountToMinor("1e3", "USD")).toThrow(MoneyError);
    expect(() => parseAmountToMinor(1e21, "USD")).toThrow(MoneyError);
  });

  it("refuse les entrées invalides", () => {
    for (const bad of ["", "   ", "abc", "1 000", "1.234.567", "$5", "12.", ".", "--5"]) {
      expect(() => parseAmountToMinor(bad, "USD"), `entrée: "${bad}"`).toThrow(MoneyError);
    }
    expect(() => parseAmountToMinor(Number.NaN, "USD")).toThrow(MoneyError);
    expect(() => parseAmountToMinor(Number.POSITIVE_INFINITY, "USD")).toThrow(MoneyError);
  });

  it("refuse une devise inconnue", () => {
    // @ts-expect-error test volontaire d'une devise hors type
    expect(() => parseAmountToMinor("10", "EUR")).toThrow(MoneyError);
  });
});

describe("decimalStringToMinor / minorToDecimalString", () => {
  it("lit les colonnes numeric PostgreSQL sérialisées en string", () => {
    expect(decimalStringToMinor("1234.50", "USD")).toBe(123450n);
    expect(decimalStringToMinor("0.05", "CDF")).toBe(5n);
  });

  it("produit la représentation décimale canonique pour l'écriture DB", () => {
    expect(minorToDecimalString(123450n, "USD")).toBe("1234.50");
    expect(minorToDecimalString(5n, "USD")).toBe("0.05");
    expect(minorToDecimalString(-5n, "USD")).toBe("-0.05");
    expect(minorToDecimalString(0n, "CDF")).toBe("0.00");
  });

  it("fait un aller-retour exact sur de grands montants", () => {
    const original = 99999999999999900n;
    expect(decimalStringToMinor(minorToDecimalString(original, "USD"), "USD")).toBe(original);
  });
});

describe("formatMinorAmount", () => {
  it("formate USD avec le symbole avant", () => {
    expect(formatMinorAmount(1234567n, "USD")).toBe("$12,345.67");
    expect(formatMinorAmount(1050n, "USD")).toBe("$10.50");
  });

  it("formate CDF avec le symbole après", () => {
    expect(formatMinorAmount(250000000n, "CDF")).toBe("2,500,000.00 FC");
  });

  it("peut omettre le symbole", () => {
    expect(formatMinorAmount(1050n, "USD", { withSymbol: false })).toBe("10.50");
  });

  it("gère les négatifs", () => {
    expect(formatMinorAmount(-500n, "USD")).toBe("-$5.00");
  });
});

describe("arithmétique entière", () => {
  it("additionne et soustrait des montants multi-devises cohérents", () => {
    const cart = addMinors(1500n, 2500n, 9900n);
    expect(cart).toBe(13900n);
    expect(subtractMinors(cart, 900n)).toBe(13000n);
  });

  it("multiplie par une quantité entière sûre", () => {
    expect(multiplyByQuantity(999n, 3)).toBe(2997n);
    expect(() => multiplyByQuantity(999n, 0)).toThrow(MoneyError);
    expect(() => multiplyByQuantity(999n, -1)).toThrow(MoneyError);
    expect(() => multiplyByQuantity(999n, 1.5)).toThrow(MoneyError);
  });

  it("expose isPositive", () => {
    expect(isPositive(1n)).toBe(true);
    expect(isPositive(0n)).toBe(false);
    expect(isPositive(-1n)).toBe(false);
  });
});

describe("commissions (snapshot §19)", () => {
  it("calcule une commission de 10 % arrondie proprement", () => {
    expect(computeCommissionAmount(10_000n, 1_000n)).toBe(1_000n); // 100 $ → 10 $
    expect(computeVendorAmount(10_000n, 1_000n)).toBe(9_000n); // vendeur → 90 $
  });

  it("arrondit au demi-point supérieur en arithmétique entière", () => {
    // 1 minor × 50 % = 0.5 minor → half-up ⇒ 1
    expect(computeCommissionAmount(1n, 5_000n)).toBe(1n);
    // 1 minor × 15 % = 0.15 minor → arrondi bas ⇒ 0
    expect(computeCommissionAmount(1n, 1_500n)).toBe(0n);
    // 205 minor × 10 % = 20.5 minor → half-up ⇒ 21
    expect(computeCommissionAmount(205n, 1_000n)).toBe(21n);
  });

  it("refuse les taux hors bornes et les commissions supérieures au montant", () => {
    expect(() => computeCommissionAmount(100n, 10_001n)).toThrow(MoneyError);
    expect(() => computeCommissionAmount(100n, -1n)).toThrow(MoneyError);
    expect(() => computeVendorAmount(100n, 101n)).toThrow(MoneyError);
  });
});
