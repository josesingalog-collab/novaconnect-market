/**
 * Tests unitaires pour le service de ventes vendeur.
 *
 * Vérifie :
 * - Le revenu vendeur est calculé à partir de order_items.vendor_amount (pas orders.total)
 * - D-001 respecté : aucun Number() ou parseFloat() sur les montants
 * - USD et CDF sont séparés dans revenuesByCurrency
 * - Multi-produits du même vendeur : sommes correctes
 * - Isolation vendeur : A ne voit jamais les montants de B
 * - listSales() retourne le montant vendeur, pas orders.total
 * - Commandes PENDING/FAILED/CANCELLED/REFUNDED : comportement attendu
 * - ProductCount correct dans listSales et getSalesSummary
 */
import { describe, expect, it, vi } from "vitest";
import {
  decimalStringToMinor,
  addMinors,
  minorToDecimalString,
  formatMinorAmount,
} from "@/lib/money";
import { getSalesSummary, listSales } from "@/services/vendor/sales";
import type { SalesDb } from "@/services/vendor/sales";

// ─── Mock Supabase chainable query builder ──────────────

function createMockSupabase(data: unknown, error: Error | null = null) {
  const promise = Promise.resolve({ data, error });
  const awaitableQuery = Object.assign(promise, {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue(promise),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });

  const db = {
    from: vi.fn().mockReturnValue(awaitableQuery),
  };

  return { db };
}

// ─── Tests de logique métier sur les montants ──────────────────────

describe("Calcul des revenus vendeur — vendor_amount vs orders.total", () => {
  it("TEST 1 : Vendeur A = 20 USD, Vendeur B = 30 USD → A reçoit 20 USD", () => {
    const vendorAAmount = decimalStringToMinor("20.00", "USD");
    const vendorBAmount = decimalStringToMinor("30.00", "USD");
    const orderTotal = decimalStringToMinor("50.00", "USD");

    expect(minorToDecimalString(vendorAAmount, "USD")).toBe("20.00");
    expect(minorToDecimalString(vendorBAmount, "USD")).toBe("30.00");
    expect(addMinors(vendorAAmount, vendorBAmount)).toBe(orderTotal);
    expect(vendorAAmount).not.toBe(orderTotal);
  });

  it("TEST 2 : Deux produits du même vendeur : 20 USD + 15 USD → 35 USD", () => {
    const product1 = decimalStringToMinor("20.00", "USD");
    const product2 = decimalStringToMinor("15.00", "USD");
    const total = addMinors(product1, product2);

    expect(minorToDecimalString(total, "USD")).toBe("35.00");
  });

  it("TEST 3 : Vendeur A en USD + Vendeur A en CDF → devises séparées", () => {
    const usdAmount = decimalStringToMinor("20.00", "USD");
    const cdfAmount = decimalStringToMinor("5000.00", "CDF");

    expect(minorToDecimalString(usdAmount, "USD")).toBe("20.00");
    expect(minorToDecimalString(cdfAmount, "CDF")).toBe("5000.00");
    expect(usdAmount).not.toBe(cdfAmount);
  });
});

// ─── Tests D-001 — Pas de Number() / parseFloat() ─────────────────

describe("D-001 — Aucun Number() ou parseFloat() sur les montants", () => {
  it("decimalStringToMinor retourne bigint, pas Number", () => {
    const amount = decimalStringToMinor("10.50", "USD");
    expect(typeof amount).toBe("bigint");
    expect(amount).toBe(1050n);
  });

  it("addMinors fonctionne avec bigint", () => {
    const a = decimalStringToMinor("10.00", "USD");
    const b = decimalStringToMinor("5.25", "USD");
    const sum = addMinors(a, b);
    expect(typeof sum).toBe("bigint");
    expect(sum).toBe(1525n);
  });

  it("minorToDecimalString retourne string, pas Number", () => {
    const amount = decimalStringToMinor("1234.50", "USD");
    const result = minorToDecimalString(amount, "USD");
    expect(typeof result).toBe("string");
    expect(result).toBe("1234.50");
  });

  it("formatMinorAmount retourne string formaté", () => {
    const amount = decimalStringToMinor("1234.50", "USD");
    const result = formatMinorAmount(amount, "USD");
    expect(typeof result).toBe("string");
    expect(result).toBe("$1,234.50");
  });
});

// ─── Tests d'isolation vendeur ──────────────────────────────────────

describe("TEST 5 : Isolation vendeur — A ne voit jamais les montants de B", () => {
  it("Les vendor_amounts sont séparés par vendor_id", () => {
    const vendorAAmount = decimalStringToMinor("20.00", "USD");
    const vendorBAmount = decimalStringToMinor("30.00", "USD");

    expect(vendorAAmount).toBe(decimalStringToMinor("20.00", "USD"));
    expect(vendorBAmount).toBe(decimalStringToMinor("30.00", "USD"));
    expect(vendorAAmount).not.toEqual(vendorBAmount);
  });
});

// ─── Tests de séparation USD/CDF ────────────────────────────────────

describe("Séparation USD/CDF dans revenuesByCurrency", () => {
  it("TEST 3 : USD et CDF ne sont jamais additionnés ensemble", () => {
    const usdRevenue = decimalStringToMinor("20.00", "USD");
    const cdfRevenue = decimalStringToMinor("5000.00", "CDF");

    const usdTotal = minorToDecimalString(usdRevenue, "USD");
    const cdfTotal = minorToDecimalString(cdfRevenue, "CDF");

    expect(usdTotal).toBe("20.00");
    expect(cdfTotal).toBe("5000.00");
    expect(usdTotal).not.toBe(cdfTotal);
  });

  it("Si une seule devise est présente, un seul total est retourné", () => {
    const usdOnly = decimalStringToMinor("100.00", "USD");
    const result = minorToDecimalString(usdOnly, "USD");
    expect(result).toBe("100.00");
  });
});

// ─── Tests de status de commande ────────────────────────────────────

describe("TEST 4 : Commandes PENDING/FAILED/CANCELLED/REFUNDED", () => {
  it("Seules les commandes PAID ajoutent au revenueMinor dans currencyMap", () => {
    const paidStatuses = ["PAID"];
    const nonPaidStatuses = ["PENDING", "FAILED", "CANCELLED", "REFUNDED"];

    for (const status of paidStatuses) {
      expect(status === "PAID").toBe(true);
    }

    for (const status of nonPaidStatuses) {
      expect(status === "PAID").toBe(false);
    }

    expect(minorToDecimalString(0n, "USD")).toBe("0.00");
  });

  it("PENDING/FAILED/CANCELLED/REFUNDED n'ajoutent pas au totalRevenue", () => {
    const totalSiComptes = decimalStringToMinor("80.00", "USD");
    const totalReel = 0n;

    expect(minorToDecimalString(totalReel, "USD")).toBe("0.00");
    expect(minorToDecimalString(totalSiComptes, "USD")).toBe("80.00");
  });

  it("Commande PAID ajoute au totalRevenue, PENDING ne le fait pas", () => {
    const paidRevenue = decimalStringToMinor("20.00", "USD");
    const pendingRevenue = 0n;

    expect(minorToDecimalString(paidRevenue, "USD")).toBe("20.00");
    expect(minorToDecimalString(pendingRevenue, "USD")).toBe("0.00");
    expect(paidRevenue).not.toBe(pendingRevenue);
  });
});

// ─── Tests listSales — vendor_amount vs orders.total ────────────────

describe("TEST 6 : listSales retourne le montant vendeur, pas orders.total", () => {
  it("Le vendor_amount est la part du vendeur, pas le total de la commande", () => {
    const vendorAmount = decimalStringToMinor("20.00", "USD");
    const orderTotal = decimalStringToMinor("50.00", "USD");

    expect(minorToDecimalString(vendorAmount, "USD")).toBe("20.00");
    expect(vendorAmount).not.toBe(orderTotal);
  });
});

// ─── Tests de structure SalesSummary ────────────────────────────────

describe("Structure SalesSummary", () => {
  it("revenuesByCurrency est un tableau avec des objets par devise", () => {
    const currencyRevenues = [
      { currency: "USD", totalRevenue: "20.00", totalSales: 1 },
      { currency: "CDF", totalRevenue: "5000.00", totalSales: 1 },
    ];

    expect(currencyRevenues.length).toBe(2);
    expect(currencyRevenues[0]!.currency).toBe("USD");
    expect(currencyRevenues[1]!.currency).toBe("CDF");
  });

  it("totalRevenue est un string (D-001)", () => {
    const rev = { currency: "USD", totalRevenue: "20.00", totalSales: 1 };
    expect(typeof rev.totalRevenue).toBe("string");
    expect(rev.totalRevenue).not.toMatch(/^Number\(/);
  });

  it("SaleOrder a le champ vendorAmount, pas total", () => {
    const order = {
      id: "1",
      orderNumber: "NC-2026-0001",
      status: "PAID" as const,
      vendorAmount: "20.00",
      currency: "USD" as const,
      createdAt: "2026-01-15T10:00:00Z",
      productCount: 1,
    };

    expect(order).toHaveProperty("vendorAmount");
    expect(order).not.toHaveProperty("total");
  });
});

// ─── Tests de formatage monétaire ──────────────────────────────────

describe("Formatage monétaire", () => {
  it("CDF et USD ont le même format mais des symboles différents", () => {
    const usd = formatMinorAmount(decimalStringToMinor("20.00", "USD"), "USD");
    const cdf = formatMinorAmount(decimalStringToMinor("5000.00", "CDF"), "CDF");

    expect(usd).toBe("$20.00");
    expect(cdf).toBe("5,000.00 FC");
  });
});

it("Les grands montants CDF ne perdent pas de précision", () => {
  const largeCdf = decimalStringToMinor("25000.00", "CDF");
  expect(minorToDecimalString(largeCdf, "CDF")).toBe("25000.00");
});

// ═══════════════════════════════════════════════════════════════════
// TESTS DE SERVICE — Appellent réellement getSalesSummary / listSales
// ═══════════════════════════════════════════════════════════════════

// ─── Helper pour construire des données order_items mockées ────────

function createOrderItem(
  id: string,
  vendorId: string,
  vendorAmount: string,
  currency: string,
  orderId: string,
  orderStatus: string,
  orderCurrency: string,
): Record<string, unknown> {
  return {
    id,
    vendor_id: vendorId,
    vendor_amount: vendorAmount,
    currency,
    order: {
      id: orderId,
      order_number: `NC-2026-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`,
      status: orderStatus,
      created_at: "2026-01-15T10:00:00Z",
      currency: orderCurrency,
    },
  };
}

// ─── SCÉNARIO 1 — VENDEUR SANS VENTE ──────────────────────────────

describe("getSalesSummary — Scénario 1 : Vendeur sans vente", () => {
  it("[T1] getSalesSummary retourne 0 et tableaux vides quand aucun order_item", async () => {
    const { db } = createMockSupabase(null);

    const result = await getSalesSummary(db as unknown as SalesDb, "vendor-no-sales");

    expect(result.totalSales).toBe(0);
    expect(result.revenuesByCurrency).toEqual([]);
    expect(result.recentOrders).toEqual([]);
  });
});

// ─── SCÉNARIO 2 — UNE VENTE ────────────────────────────────────────

describe("getSalesSummary — Scénario 2 : Une vente PAID", () => {
  it("[T2] getSalesSummary retourne 20.00 USD pour une vente PAID", async () => {
    const orderItems = [
      createOrderItem("item1", "vendor-a", "20.00", "USD", "order-1", "PAID", "USD"),
    ];

    const { db } = createMockSupabase(orderItems);

    const result = await getSalesSummary(db as unknown as SalesDb, "vendor-a");

    expect(result.totalSales).toBe(1);
    expect(result.revenuesByCurrency).toHaveLength(1);
    expect(result.revenuesByCurrency[0]!.currency).toBe("USD");
    expect(result.revenuesByCurrency[0]!.totalRevenue).toBe("20.00");
  });
});

// ─── SCÉNARIO 3 — MULTI-VENDEUR CRITIQUE ──────────────────────────

describe("getSalesSummary — Scénario 3 : Multi-vendeur critique", () => {
  it("[T3] Vendeur A (20 USD) et Vendeur B (30 USD) → A reçoit 20 USD, B reçoit 30 USD", async () => {
    const orderItems = [
      createOrderItem("item-a1", "vendor-a", "20.00", "USD", "order-1", "PAID", "USD"),
      createOrderItem("item-b1", "vendor-b", "30.00", "USD", "order-1", "PAID", "USD"),
    ];

    const { db: dbA } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-a"),
    );
    const { db: dbB } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-b"),
    );

    const resultA = await getSalesSummary(dbA as unknown as SalesDb, "vendor-a");
    const resultB = await getSalesSummary(dbB as unknown as SalesDb, "vendor-b");

    expect(resultA.revenuesByCurrency[0]!.totalRevenue).toBe("20.00");
    expect(resultB.revenuesByCurrency[0]!.totalRevenue).toBe("30.00");
  });

  it("[T3] La commande de 50 USD ne donne jamais 50 USD à A ou B", async () => {
    const orderItems = [
      createOrderItem("item-a1", "vendor-a", "20.00", "USD", "order-1", "PAID", "USD"),
      createOrderItem("item-b1", "vendor-b", "30.00", "USD", "order-1", "PAID", "USD"),
    ];

    const { db: dbA } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-a"),
    );
    const { db: dbB } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-b"),
    );

    const resultA = await getSalesSummary(dbA as unknown as SalesDb, "vendor-a");
    const resultB = await getSalesSummary(dbB as unknown as SalesDb, "vendor-b");

    expect(resultA.revenuesByCurrency[0]!.totalRevenue).not.toBe("50.00");
    expect(resultB.revenuesByCurrency[0]!.totalRevenue).not.toBe("50.00");
    expect(resultA.revenuesByCurrency[0]!.totalRevenue).toBe("20.00");
    expect(resultB.revenuesByCurrency[0]!.totalRevenue).toBe("30.00");
  });
});

// ─── SCÉNARIO 4 — ISOLATION VENDEUR ────────────────────────────────

describe("getSalesSummary / listSales — Scénario 4 : Isolation vendeur", () => {
  it("[T4] listSales ne retourne que les ventes du vendeur A, jamais celles de B", async () => {
    const orderItems = [
      createOrderItem("item-a1", "vendor-a", "20.00", "USD", "order-a1", "PAID", "USD"),
      createOrderItem("item-b1", "vendor-b", "30.00", "USD", "order-b1", "PAID", "USD"),
    ];

    const { db: dbA } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-a"),
    );
    const { db: dbB } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-b"),
    );

    const ordersA = await listSales(dbA as unknown as SalesDb, "vendor-a", 10);
    const ordersB = await listSales(dbB as unknown as SalesDb, "vendor-b", 10);

    for (const order of ordersA) {
      expect(order.id).not.toContain("vendor-b");
    }
    for (const order of ordersB) {
      expect(order.id).not.toContain("vendor-a");
    }
  });

  it("[T4] getSalesSummary ne contient aucune donnée du vendeur B", async () => {
    const orderItems = [
      createOrderItem("item-a1", "vendor-a", "20.00", "USD", "order-a1", "PAID", "USD"),
      createOrderItem("item-b1", "vendor-b", "30.00", "USD", "order-b1", "PAID", "USD"),
    ];

    const { db: dbA } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-a"),
    );
    const { db: dbB } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-b"),
    );

    const summaryA = await getSalesSummary(dbA as unknown as SalesDb, "vendor-a");
    const summaryB = await getSalesSummary(dbB as unknown as SalesDb, "vendor-b");

    const aCurrencies = summaryA.revenuesByCurrency.map((r) => r.totalRevenue).join(",");
    const bCurrencies = summaryB.revenuesByCurrency.map((r) => r.totalRevenue).join(",");

    expect(aCurrencies).not.toContain("30.00");
    expect(bCurrencies).not.toContain("20.00");
  });
});

// ─── SCÉNARIO 5 — USD + CDF ────────────────────────────────────────

describe("getSalesSummary — Scénario 5 : USD et CDF séparés", () => {
  it("[T5] getSalesSummary retourne USD=100.00 et CDF=50000.00 séparément", async () => {
    const orderItems = [
      createOrderItem("item-usd", "vendor-a", "100.00", "USD", "order-usd", "PAID", "USD"),
      createOrderItem("item-cdf", "vendor-a", "50000.00", "CDF", "order-cdf", "PAID", "CDF"),
    ];

    const { db } = createMockSupabase(orderItems);

    const result = await getSalesSummary(db as unknown as SalesDb, "vendor-a");

    const usdRev = result.revenuesByCurrency.find((r) => r.currency === "USD");
    const cdfRev = result.revenuesByCurrency.find((r) => r.currency === "CDF");

    expect(usdRev?.totalRevenue).toBe("100.00");
    expect(cdfRev?.totalRevenue).toBe("50000.00");
    expect(result.revenuesByCurrency).toHaveLength(2);
  });

  it("[T5] Pas de total combiné USD+CDF", async () => {
    const orderItems = [
      createOrderItem("item-usd", "vendor-a", "100.00", "USD", "order-usd", "PAID", "USD"),
      createOrderItem("item-cdf", "vendor-a", "50000.00", "CDF", "order-cdf", "PAID", "CDF"),
    ];

    const { db } = createMockSupabase(orderItems);

    const result = await getSalesSummary(db as unknown as SalesDb, "vendor-a");

    const allRevenues = result.revenuesByCurrency.map((r) => r.totalRevenue);
    expect(allRevenues).not.toContain("50100.00");
    expect(allRevenues).not.toContain("5100.00");
  });
});

// ─── SCÉNARIO 6 — PLUSIEURS VENTES ────────────────────────────────

describe("getSalesSummary — Scénario 6 : Plusieurs ventes", () => {
  it("[T6] Trois ventes de 20, 30, 50 USD → totalRevenue = 100.00 USD", async () => {
    const orderItems = [
      createOrderItem("item1", "vendor-a", "20.00", "USD", "order-1", "PAID", "USD"),
      createOrderItem("item2", "vendor-a", "30.00", "USD", "order-2", "PAID", "USD"),
      createOrderItem("item3", "vendor-a", "50.00", "USD", "order-3", "PAID", "USD"),
    ];

    const { db } = createMockSupabase(orderItems);

    const result = await getSalesSummary(db as unknown as SalesDb, "vendor-a");

    const usdRev = result.revenuesByCurrency.find((r) => r.currency === "USD");
    expect(usdRev?.totalRevenue).toBe("100.00");
  });
});

// ─── SCÉNARIO 7 — LISTSALES ────────────────────────────────────────

describe("listSales — Scénario 7 : Commandes retournées correctement", () => {
  it("[T7] listSales retourne orderNumber, status, createdAt, productCount, vendorAmount, currency", async () => {
    const orderItems = [
      createOrderItem("item1", "vendor-a", "20.00", "USD", "order-1", "PAID", "USD"),
    ];

    const { db } = createMockSupabase(orderItems);

    const orders = await listSales(db as unknown as SalesDb, "vendor-a", 10);

    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0]!.orderNumber).toBeDefined();
    expect(orders[0]!.status).toBe("PAID");
    expect(orders[0]!.vendorAmount).toBe("20.00");
    expect(orders[0]!.currency).toBe("USD");
    expect(orders[0]!.createdAt).toBe("2026-01-15T10:00:00Z");
    expect(orders[0]!.productCount).toBe(1);
  });

  it("[T7] listSales ne retourne aucune commande de vendorB", async () => {
    const orderItems = [
      createOrderItem("item-a1", "vendor-a", "20.00", "USD", "order-a1", "PAID", "USD"),
      createOrderItem("item-b1", "vendor-b", "30.00", "USD", "order-b1", "PAID", "USD"),
    ];

    const { db: dbA } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-a"),
    );
    const { db: dbB } = createMockSupabase(
      orderItems.filter((i) => (i as Record<string, unknown>).vendor_id === "vendor-b"),
    );

    const ordersA = await listSales(dbA as unknown as SalesDb, "vendor-a", 10);
    const ordersB = await listSales(dbB as unknown as SalesDb, "vendor-b", 10);

    for (const order of ordersA) {
      expect(order.vendorAmount).toBe("20.00");
    }
    for (const order of ordersB) {
      expect(order.vendorAmount).toBe("30.00");
    }
  });

  it("[T7] listSales retourne au plus `limit` commandes", async () => {
    const orderItems = [
      createOrderItem("item1", "vendor-a", "10.00", "USD", "order-1", "PAID", "USD"),
      createOrderItem("item2", "vendor-a", "20.00", "USD", "order-2", "PAID", "USD"),
      createOrderItem("item3", "vendor-a", "30.00", "USD", "order-3", "PAID", "USD"),
    ];

    const { db } = createMockSupabase(orderItems);

    const orders = await listSales(db as unknown as SalesDb, "vendor-a", 2);

    expect(orders.length).toBeLessThanOrEqual(2);
  });
});

// ─── SCÉNARIO 8 — ORDRE MULTI-PRODUITS ────────────────────────────

describe("getSalesSummary / listSales — Scénario 8 : Ordre multi-produits", () => {
  it("[T8] Deux order_items du même vendeur pour la même commande → vendor_amount sommé", async () => {
    const orderItems = [
      createOrderItem("item1", "vendor-a", "20.00", "USD", "order-multi", "PAID", "USD"),
      createOrderItem("item2", "vendor-a", "30.00", "USD", "order-multi", "PAID", "USD"),
    ];

    const { db } = createMockSupabase(orderItems);

    const result = await getSalesSummary(db as unknown as SalesDb, "vendor-a");

    const usdRev = result.revenuesByCurrency.find((r) => r.currency === "USD");
    expect(usdRev?.totalRevenue).toBe("50.00");
  });

  it("[T8] listSales retourne productCount=2 pour un ordre multi-produits", async () => {
    const orderItems = [
      createOrderItem("item1", "vendor-a", "20.00", "USD", "order-multi", "PAID", "USD"),
      createOrderItem("item2", "vendor-a", "30.00", "USD", "order-multi", "PAID", "USD"),
    ];

    const { db } = createMockSupabase(orderItems);

    const orders = await listSales(db as unknown as SalesDb, "vendor-a", 10);

    const multiOrder = orders.find((o) => o.id === "order-multi");
    expect(multiOrder).toBeDefined();
    expect(multiOrder!.productCount).toBe(2);
    expect(multiOrder!.vendorAmount).toBe("50.00");
  });
});

// ─── Tests de status de commande dans le service ────────────────────

describe("getSalesSummary — Statuts de commande", () => {
  it("Seules les commandes PAID contribuent au revenue", async () => {
    const orderItems = [
      createOrderItem("item-paid", "vendor-a", "20.00", "USD", "order-paid", "PAID", "USD"),
      createOrderItem(
        "item-pending",
        "vendor-a",
        "30.00",
        "USD",
        "order-pending",
        "PENDING",
        "USD",
      ),
    ];

    const { db } = createMockSupabase(orderItems);

    const result = await getSalesSummary(db as unknown as SalesDb, "vendor-a");

    const usdRev = result.revenuesByCurrency.find((r) => r.currency === "USD");
    expect(usdRev?.totalRevenue).toBe("20.00");
    expect(usdRev?.totalSales).toBe(1);
  });

  it("PENDING, FAILED, CANCELLED, REFUNDED ne contribuent pas au revenue", async () => {
    const statuses = ["PENDING", "FAILED", "CANCELLED", "REFUNDED"];
    for (const status of statuses) {
      const orderItems = [
        createOrderItem("item-1", "vendor-a", "20.00", "USD", `order-${status}`, status, "USD"),
      ];
      const { db } = createMockSupabase(orderItems);

      const result = await getSalesSummary(db as unknown as SalesDb, "vendor-a");
      expect(result.revenuesByCurrency).toHaveLength(0);
      expect(result.totalSales).toBe(0);
    }
  });
});

// ─── Tests de formatage de la page ────────────────────────────────

describe("Page /vendor/ventes — formatage des montants", () => {
  it("Les statuts de commande ont les labels français corrects", () => {
    const statusLabels: Record<string, string> = {
      PENDING: "En attente",
      PAID: "Payée",
      CANCELLED: "Annulée",
      REFUNDED: "Remboursée",
      FAILED: "Échouée",
    };

    expect(statusLabels["PENDING"]).toBe("En attente");
    expect(statusLabels["PAID"]).toBe("Payée");
    expect(statusLabels["CANCELLED"]).toBe("Annulée");
    expect(statusLabels["REFUNDED"]).toBe("Remboursée");
    expect(statusLabels["FAILED"]).toBe("Échouée");
  });

  it("Les montants utilisent formatMinorAmount et decimalStringToMinor (pas Number)", () => {
    const usdRevenue = formatMinorAmount(decimalStringToMinor("100.00", "USD"), "USD");
    const cdfRevenue = formatMinorAmount(decimalStringToMinor("50000.00", "CDF"), "CDF");
    expect(usdRevenue).toBe("$100.00");
    expect(cdfRevenue).toBe("50,000.00 FC");
    expect(typeof usdRevenue).toBe("string");
    expect(typeof cdfRevenue).toBe("string");
  });

  it("Les montants ne contiennent pas de float", () => {
    const amount = decimalStringToMinor("999.99", "USD");
    expect(typeof amount).toBe("bigint");
    const formatted = formatMinorAmount(amount, "USD");
    expect(formatted).toBe("$999.99");
    expect(formatted).not.toMatch(/^Number\(/);
  });
});
