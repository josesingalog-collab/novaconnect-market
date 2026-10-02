import { describe, expect, it } from "vitest";
import { formatPrice } from "@/components/marketplace/format";

describe("formatPrice", () => {
  it("formatte USD avec bigint", () => {
    expect(formatPrice("10.00", "USD")).toBe("$10.00");
  });

  it("formatte CDF avec bigint", () => {
    expect(formatPrice("10.50", "CDF")).toBe("10.50 FC");
  });

  it("formatte prix avec milliers", () => {
    expect(formatPrice("1234.50", "USD")).toBe("$1,234.50");
  });

  it("retourne la valeur brute si prix invalide", () => {
    expect(formatPrice("abc", "USD")).toBe("abc USD");
  });

  it("ne modifie pas la valeur stockée", () => {
    const price = "19.99";
    formatPrice(price, "USD");
    expect(price).toBe("19.99");
  });
});
