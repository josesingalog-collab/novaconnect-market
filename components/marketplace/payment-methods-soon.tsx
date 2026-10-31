const methods = [
  { name: "Airtel Money", mark: "airtel", label: "airtel" },
  { name: "Orange Money", mark: "orange", label: "orange" },
  { name: "Vodacom", mark: "vodacom", label: "V" },
  { name: "Africell", mark: "africell", label: "africell" },
  { name: "Visa", mark: "visa", label: "VISA" },
  { name: "Mastercard", mark: "mastercard", label: "" },
] as const;

export function PaymentMethodsSoon() {
  return (
    <div className="mt-5 border-t border-border pt-4 text-center">
      <p className="text-sm font-medium text-foreground">Moyens de paiement bientôt disponibles</p>
      <div className="mt-3 flex flex-wrap justify-center gap-2" aria-label="Moyens de paiement à venir">
        {methods.map((method) => (
          <div
            key={method.name}
            title={method.name}
            className="flex h-10 min-w-14 items-center justify-center rounded-md border border-border bg-muted/40 px-2"
          >
            {method.mark === "mastercard" ? (
              <span className="relative h-5 w-8" aria-label={method.name}>
                <span className="absolute top-0 left-0 h-5 w-5 rounded-full bg-red-500" />
                <span className="absolute top-0 right-0 h-5 w-5 rounded-full bg-amber-400/95" />
              </span>
            ) : (
              <span
                className={[
                  "text-[10px] font-bold tracking-tight",
                  method.mark === "airtel" && "italic text-red-500",
                  method.mark === "orange" && "bg-orange-500 px-1.5 py-1 text-[8px] text-white",
                  method.mark === "vodacom" &&
                    "flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white",
                  method.mark === "africell" && "text-orange-500",
                  method.mark === "visa" && "italic text-blue-700",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {method.label}
              </span>
            )}
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Aucun paiement réel n&apos;est encore traité par ces moyens.
      </p>
    </div>
  );
}
