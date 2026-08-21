export const PAYMENT_CURRENCY = "usd";
export const PLATFORM_FEE_BASIS_POINTS = 300;

export type PaymentStatus = "open" | "paid" | "partially_refunded" | "refunded" | "disputed" | "chargeback";
export type PaymentState = {
  requestId: string; sitterStripeAccountId: string; amountCents: number; currency: string; status: PaymentStatus;
  refundedAmountCents: number; stripeCheckoutSessionId: string | null; stripePaymentIntentId: string | null; stripeChargeId: string | null;
};
export type PaymentSignal = {
  kind: "checkout" | "refund" | "dispute_created" | "dispute_closed"; requestId: string; stripeAccountId: string;
  amountCents: number; currency: string; checkoutSessionId?: string; paymentIntentId?: string; chargeId?: string;
  refundedAmountCents?: number; disputeOutcome?: "won" | "lost";
};

export function calculatePlatformFeeCents(amountCents: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 100) throw new Error("Payment amount must be at least 100 cents");
  const fee = Math.round((amountCents * PLATFORM_FEE_BASIS_POINTS) / 10_000);
  if (fee <= 0 || fee >= amountCents) throw new Error("Platform fee must be positive and less than the payment amount");
  return fee;
}

export function calculateApplicationFeeRefundTargetCents(platformFeeCents: number, amountCents: number, refundedAmountCents: number): number {
  if (![platformFeeCents, amountCents, refundedAmountCents].every(Number.isSafeInteger)) throw new Error("Refund amounts must be integers");
  if (platformFeeCents <= 0 || platformFeeCents >= amountCents || refundedAmountCents < 0 || refundedAmountCents > amountCents) throw new Error("Invalid refund amounts");
  return refundedAmountCents === amountCents ? platformFeeCents : Math.floor((platformFeeCents * refundedAmountCents) / amountCents);
}

function validateSignal(state: PaymentState, signal: PaymentSignal): void {
  if (signal.requestId !== state.requestId) throw new Error("Stripe metadata does not match this payment request");
  if (signal.stripeAccountId !== state.sitterStripeAccountId) throw new Error("Stripe connected account does not match this sitter");
  if (signal.amountCents !== state.amountCents) throw new Error("Stripe amount does not match this payment request");
  if (signal.currency.toLowerCase() !== state.currency) throw new Error("Stripe currency does not match this payment request");
  if (signal.checkoutSessionId && state.stripeCheckoutSessionId && signal.checkoutSessionId !== state.stripeCheckoutSessionId) throw new Error("Stripe Checkout Session conflicts with the stored session");
  if (signal.paymentIntentId && state.stripePaymentIntentId && signal.paymentIntentId !== state.stripePaymentIntentId) throw new Error("Stripe PaymentIntent conflicts with the stored PaymentIntent");
  if (signal.chargeId && state.stripeChargeId && signal.chargeId !== state.stripeChargeId) throw new Error("Stripe Charge conflicts with the stored Charge");
}

export function applyPaymentSignal(state: PaymentState, signal: PaymentSignal): PaymentState {
  validateSignal(state, signal);
  const next = { ...state };
  if (signal.checkoutSessionId) next.stripeCheckoutSessionId ??= signal.checkoutSessionId;
  if (signal.paymentIntentId) next.stripePaymentIntentId ??= signal.paymentIntentId;
  if (signal.chargeId) next.stripeChargeId ??= signal.chargeId;
  if (signal.kind === "checkout") { if (next.status === "open") next.status = "paid"; return next; }
  if (signal.kind === "refund") {
    const refunded = signal.refundedAmountCents;
    if (refunded === undefined || refunded < next.refundedAmountCents || refunded > next.amountCents) throw new Error("Invalid cumulative refund amount");
    next.refundedAmountCents = refunded;
    if (next.status !== "disputed" && next.status !== "chargeback") next.status = refunded === next.amountCents ? "refunded" : "partially_refunded";
    return next;
  }
  if (signal.kind === "dispute_created") { next.status = "disputed"; return next; }
  if (signal.disputeOutcome === "lost") next.status = "chargeback";
  else if (signal.disputeOutcome === "won") next.status = next.refundedAmountCents === next.amountCents ? "refunded" : next.refundedAmountCents > 0 ? "partially_refunded" : "paid";
  return next;
}

export type CheckoutSessionSnapshot = { id: string; stripeAccountId: string; paymentStatus: string; status: string | null; clientReferenceId: string | null; paymentRequestId: string | null; amountTotal: number | null; currency: string | null };
export function validatePaidCheckoutSession(state: PaymentState, session: CheckoutSessionSnapshot): void {
  if (session.stripeAccountId !== state.sitterStripeAccountId) throw new Error("Checkout Session was not retrieved for this sitter");
  if (session.paymentStatus !== "paid" || session.status !== "complete") throw new Error("Checkout Session is not paid and complete");
  if (session.clientReferenceId !== state.requestId || session.paymentRequestId !== state.requestId) throw new Error("Checkout Session does not belong to this request");
  if (session.amountTotal !== state.amountCents || session.currency?.toLowerCase() !== state.currency) throw new Error("Checkout Session amount or currency does not match");
  if (state.stripeCheckoutSessionId && session.id !== state.stripeCheckoutSessionId) throw new Error("Checkout Session is not the canonical session for this request");
}
