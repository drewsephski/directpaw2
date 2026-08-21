import { describe, expect, test } from "bun:test";
import { buildCheckoutSessionParams, checkoutLifecycleDecision, type CheckoutRow, type CheckoutSnapshot } from "@/lib/checkout";

const request = { id: "11111111-1111-4111-8111-111111111111", amount_cents: 10_000, currency: "usd" };
const session = (overrides: Partial<CheckoutSnapshot> = {}): CheckoutSnapshot => ({
  id: "cs_canonical", status: "open", paymentStatus: "unpaid", url: "https://checkout.stripe.test/c/pay/cs_canonical",
  clientReferenceId: request.id, paymentRequestId: request.id, amountTotal: 10_000, currency: "usd", ...overrides,
});

describe("canonical Checkout lifecycle", () => {
  test("reuses the canonical open Session", () => {
    expect(checkoutLifecycleDecision(request, session())).toBe("reuse");
  });

  test("a completed paid Session blocks replacement before webhook persistence", () => {
    expect(checkoutLifecycleDecision(request, session({ status: "complete", paymentStatus: "paid", url: null }))).toBe("paid");
  });

  test("an expired Session selects deterministic replacement behavior", () => {
    expect(checkoutLifecycleDecision(request, session({ status: "expired", url: null }))).toBe("replace");
  });

  test("rejects unrelated, wrong-amount, and non-payable Sessions", () => {
    expect(() => checkoutLifecycleDecision(request, session({ paymentRequestId: "other" }))).toThrow();
    expect(() => checkoutLifecycleDecision(request, session({ amountTotal: 9_999 }))).toThrow();
    expect(() => checkoutLifecycleDecision(request, session({ status: "complete", paymentStatus: "unpaid", url: null }))).toThrow();
  });
});

describe("Checkout payment method contract", () => {
  test("accepts only cards and card-backed wallets", () => {
    const row: CheckoutRow = {
      id: request.id,
      public_token: "public-token",
      amount_cents: request.amount_cents,
      platform_fee_cents: 300,
      description: "Pet sitting",
      client_email: "owner@example.com",
      currency: request.currency,
      status: "open",
      stripe_checkout_session_id: null,
      stripe_account_id: "acct_sitter",
    };

    expect(buildCheckoutSessionParams(row).payment_method_types).toEqual(["card"]);
  });
});
