import { describe, expect, it } from "vitest";
import {
  PAYMENT_SIGNATURE_HEADER,
  createPaymentSignature,
  deriveEventHash,
  verifyPaymentSignature,
} from "@/lib/payments/signature";
import { createHmac } from "node:crypto";

const SECRET = "secret-webhook-test-0123456789abcdef";
const BODY = JSON.stringify({ payment_id: "11111111-1111-1111-1111-111111111111" });

describe("createPaymentSignature", () => {
  it("produit un HMAC-SHA256 hexadécimal du corps brut", () => {
    expect(createPaymentSignature(BODY, SECRET)).toBe(
      createHmac("sha256", SECRET).update(BODY, "utf8").digest("hex"),
    );
  });

  it("est sensible au moindre octet du corps", () => {
    expect(createPaymentSignature(BODY, SECRET)).not.toBe(
      createPaymentSignature(BODY + " ", SECRET),
    );
  });
});

describe("verifyPaymentSignature", () => {
  it("accepte la signature correcte", () => {
    const signature = createPaymentSignature(BODY, SECRET);
    expect(verifyPaymentSignature(BODY, SECRET, signature)).toBe(true);
  });

  it("tolère majuscules et espaces d'entourage", () => {
    const signature = createPaymentSignature(BODY, SECRET);
    expect(verifyPaymentSignature(BODY, SECRET, ` ${signature.toUpperCase()} `)).toBe(true);
  });

  it("refuse un corps modifié (tamper)", () => {
    const signature = createPaymentSignature(BODY, SECRET);
    expect(verifyPaymentSignature(BODY + '"', SECRET, signature)).toBe(false);
  });

  it("refuse un mauvais secret", () => {
    const signature = createPaymentSignature(BODY, "autre-secret");
    expect(verifyPaymentSignature(BODY, SECRET, signature)).toBe(false);
  });

  it("refuse les entrées malformées sans lever", () => {
    expect(verifyPaymentSignature(BODY, SECRET, null)).toBe(false);
    expect(verifyPaymentSignature(BODY, SECRET, undefined)).toBe(false);
    expect(verifyPaymentSignature(BODY, SECRET, "")).toBe(false);
    expect(verifyPaymentSignature(BODY, SECRET, "zz-invalide")).toBe(false);
  });

  it("expose le nom canonique de l'en-tête", () => {
    expect(PAYMENT_SIGNATURE_HEADER).toBe("x-nc-signature");
  });
});

describe("deriveEventHash", () => {
  it("dérive un condensat stable et sensible au contenu", () => {
    expect(deriveEventHash(BODY)).toBe(deriveEventHash(BODY));
    expect(deriveEventHash(BODY)).not.toBe(deriveEventHash(BODY + " "));
  });
});
