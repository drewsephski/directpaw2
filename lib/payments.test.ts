import { describe, expect, test } from "bun:test";
import { applyPaymentSignal, calculateApplicationFeeRefundTargetCents, calculatePlatformFeeCents, type PaymentSignal, type PaymentState, validatePaidCheckoutSession } from "@/lib/payments";

const baseState = (overrides: Partial<PaymentState> = {}): PaymentState => ({
  requestId: "11111111-1111-4111-8111-111111111111", sitterStripeAccountId: "acct_sitter", amountCents: 10_000,
  currency: "usd", status: "open", refundedAmountCents: 0, stripeCheckoutSessionId: null,
  stripePaymentIntentId: null, stripeChargeId: null, ...overrides,
});
const signal = (overrides: Partial<PaymentSignal> = {}): PaymentSignal => ({
  kind: "checkout", requestId: baseState().requestId, stripeAccountId: "acct_sitter", amountCents: 10_000,
  currency: "usd", checkoutSessionId: "cs_1", paymentIntentId: "pi_1", chargeId: "ch_1", ...overrides,
});

describe("platform fee calculation", () => {
  test("calculates 3% with integer rounding at boundaries", () => {
    expect(calculatePlatformFeeCents(100)).toBe(3);
    expect(calculatePlatformFeeCents(101)).toBe(3);
    expect(calculatePlatformFeeCents(150)).toBe(5);
    expect(calculatePlatformFeeCents(1_000_000)).toBe(30_000);
  });
  test("rejects invalid amounts", () => {
    expect(() => calculatePlatformFeeCents(99)).toThrow();
    expect(() => calculatePlatformFeeCents(100.5)).toThrow();
  });
});

describe("cumulative application-fee refunds", () => {
  test("uses cumulative targets and guarantees a complete final refund", () => {
    expect(calculateApplicationFeeRefundTargetCents(300, 10_000, 3_333)).toBe(99);
    expect(calculateApplicationFeeRefundTargetCents(300, 10_000, 5_000)).toBe(150);
    expect(calculateApplicationFeeRefundTargetCents(300, 10_000, 10_000)).toBe(300);
  });
});

describe("payment event ordering and idempotency", () => {
  test("a legacy request with no canonical Session adopts its first valid Checkout", () => {
    expect(applyPaymentSignal(baseState(), signal()).stripeCheckoutSessionId).toBe("cs_1");
  });
  test("a different Checkout cannot replace the canonical Session", () => {
    expect(() => applyPaymentSignal(baseState({ stripeCheckoutSessionId: "cs_canonical" }), signal({ checkoutSessionId: "cs_other" }))).toThrow();
  });
  test("duplicate successful Checkout objects are a no-op", () => {
    const paid = applyPaymentSignal(baseState(), signal());
    expect(applyPaymentSignal(paid, signal())).toEqual(paid);
  });
  test("refund can arrive before Checkout and a late Checkout cannot downgrade it", () => {
    const refunded = applyPaymentSignal(baseState(), signal({ kind: "refund", refundedAmountCents: 2_500, checkoutSessionId: undefined }));
    expect(refunded.status).toBe("partially_refunded");
    expect(applyPaymentSignal(refunded, signal()).status).toBe("partially_refunded");
  });
  test("partial then full refund reaches refunded", () => {
    const partial = applyPaymentSignal(baseState({ status: "paid" }), signal({ kind: "refund", refundedAmountCents: 2_500, checkoutSessionId: undefined }));
    const full = applyPaymentSignal(partial, signal({ kind: "refund", refundedAmountCents: 10_000, checkoutSessionId: undefined }));
    expect(partial.status).toBe("partially_refunded");
    expect(full.status).toBe("refunded");
  });
  test("rejects mismatched request, account, amount, and currency", () => {
    for (const mismatch of [{ requestId: "other" }, { stripeAccountId: "acct_other" }, { amountCents: 9_999 }, { currency: "cad" }]) {
      expect(() => applyPaymentSignal(baseState(), signal(mismatch))).toThrow();
    }
  });
  test("won and lost disputes have explicit outcomes", () => {
    const disputed = applyPaymentSignal(baseState({ status: "paid" }), signal({ kind: "dispute_created" }));
    expect(disputed.status).toBe("disputed");
    expect(applyPaymentSignal(disputed, signal({ kind: "dispute_closed", disputeOutcome: "won" })).status).toBe("paid");
    expect(applyPaymentSignal(disputed, signal({ kind: "dispute_closed", disputeOutcome: "lost" })).status).toBe("chargeback");
  });
});

describe("success page Checkout validation", () => {
  const session = { id: "cs_1", stripeAccountId: "acct_sitter", paymentStatus: "paid", status: "complete", clientReferenceId: baseState().requestId, paymentRequestId: baseState().requestId, amountTotal: 10_000, currency: "usd" };
  test("accepts only a matching paid complete Session", () => expect(() => validatePaidCheckoutSession(baseState(), session)).not.toThrow());
  test("rejects unpaid, wrong-request, and wrong-amount Sessions", () => {
    expect(() => validatePaidCheckoutSession(baseState(), { ...session, paymentStatus: "unpaid" })).toThrow();
    expect(() => validatePaidCheckoutSession(baseState(), { ...session, clientReferenceId: "other" })).toThrow();
    expect(() => validatePaidCheckoutSession(baseState(), { ...session, amountTotal: 9_999 })).toThrow();
    expect(() => validatePaidCheckoutSession(baseState(), { ...session, stripeAccountId: "acct_other" })).toThrow();
    expect(() => validatePaidCheckoutSession(baseState({ stripeCheckoutSessionId: "cs_canonical" }), session)).toThrow();
  });
});
