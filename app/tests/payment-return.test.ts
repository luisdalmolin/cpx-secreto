import {
  isSafeCheckoutUrl,
  normalizePaymentReturn,
} from "@/features/orders/payment-return";

describe("payment return handling", () => {
  test("normalizes the Expo Linking host form used by Mercado Pago callbacks", () => {
    expect(normalizePaymentReturn("payments", "success", "42")).toEqual({
      orderId: 42,
      result: "success",
    });
  });

  test("normalizes the equivalent triple-slash path form", () => {
    expect(normalizePaymentReturn(null, "payments/pending", "42")).toEqual({
      orderId: 42,
      result: "pending",
    });
  });

  test("rejects unrecognized callback paths and invalid order identifiers", () => {
    expect(normalizePaymentReturn("payments", "unknown", "42")).toBeUndefined();
    expect(
      normalizePaymentReturn("payments", "failure", "invalid"),
    ).toBeUndefined();
  });

  test("allows only credential-free HTTPS checkout URLs", () => {
    expect(
      isSafeCheckoutUrl(
        "https://www.mercadopago.com.br/checkout/v1/redirect?id=42",
      ),
    ).toBe(true);
    expect(
      isSafeCheckoutUrl("http://www.mercadopago.com.br/checkout"),
    ).toBe(false);
    expect(isSafeCheckoutUrl("javascript:alert(1)")).toBe(false);
    expect(
      isSafeCheckoutUrl("https://user:secret@example.test/checkout"),
    ).toBe(false);
    expect(isSafeCheckoutUrl("not a URL")).toBe(false);
  });
});
