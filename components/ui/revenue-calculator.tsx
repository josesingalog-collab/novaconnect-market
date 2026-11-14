"use client";

import { useMemo, useState } from "react";

type CalculatorCurrency = "USD" | "CDF";

const RANGES: Record<CalculatorCurrency, { min: number; max: number; step: number }> = {
  USD: { min: 5, max: 500, step: 5 },
  CDF: { min: 5_000, max: 500_000, step: 5_000 },
};

function formatAmount(value: number, currency: CalculatorCurrency): string {
  const formatted = new Intl.NumberFormat("fr-FR").format(Math.round(value));
  return currency === "USD" ? `${formatted} USD` : `${formatted} FC`;
}

interface RevenueCalculatorProps {
  /** Taux de commission en pourcentage (ex. 10 pour 10 %). */
  commissionPercent: number;
}

export function RevenueCalculator({ commissionPercent }: RevenueCalculatorProps) {
  const [currency, setCurrency] = useState<CalculatorCurrency>("USD");
  const [gross, setGross] = useState<number>(100);

  const range = RANGES[currency];
  const net = useMemo(
    () => gross * (1 - commissionPercent / 100),
    [gross, commissionPercent],
  );

  function switchCurrency(next: CalculatorCurrency) {
    setCurrency(next);
    setGross(next === "USD" ? 100 : 100_000);
  }

  return (
    <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
      <p className="text-sm font-semibold text-foreground">Calculez vos revenus en un clic</p>

      <div className="mt-4 flex gap-2" role="group" aria-label="Choix de la devise">
        {(Object.keys(RANGES) as CalculatorCurrency[]).map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => switchCurrency(code)}
            aria-pressed={currency === code}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              currency === code
                ? "bg-primary text-primary-foreground"
                : "border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {code === "USD" ? "USD" : "CDF"}
          </button>
        ))}
      </div>

      <label htmlFor="revenue-range" className="mt-5 block text-xs text-muted-foreground">
        Vos ventes mensuelles :{" "}
        <span className="font-semibold text-foreground">{formatAmount(gross, currency)}</span>
      </label>
      <input
        id="revenue-range"
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={gross}
        onChange={(event) => setGross(Number(event.target.value))}
        className="mt-2 w-full accent-primary"
      />

      <p
        key={`${currency}-${gross}`}
        className="animate-fade-in mt-4 rounded-xl bg-secondary px-4 py-3 text-sm text-secondary-foreground"
      >
        Vous gardez{" "}
        <strong className="font-bold">{formatAmount(net, currency)}</strong> après la commission de{" "}
        {commissionPercent}&nbsp;%.
      </p>
    </div>
  );
}
