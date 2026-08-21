import { db } from "@/lib/db";
import type { PaymentState, PaymentStatus } from "@/lib/payments";

export type PaymentRequest = {
  id: string; publicToken: string; amountCents: number; platformFeeCents: number; description: string; clientEmail: string | null;
  currency: string; status: PaymentStatus; refundedAmountCents: number; applicationFeeRefundedCents: number;
  stripeCheckoutSessionId: string | null; stripePaymentIntentId: string | null; stripeChargeId: string | null;
  stripeApplicationFeeId: string | null; paidAt: Date | null; sitterId: string; businessName: string;
  stripeAccountId: string | null; stripeReady: boolean;
};

type PaymentRequestRow = {
  id: string; public_token: string; amount_cents: number; platform_fee_cents: number; description: string;
  client_email: string | null; currency: string; status: PaymentStatus; refunded_amount_cents: number;
  application_fee_refunded_cents: number; stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null; stripe_charge_id: string | null; stripe_application_fee_id: string | null;
  paid_at: Date | null; sitter_id: string; business_name: string; stripe_account_id: string | null; stripe_ready: boolean;
};

function mapPaymentRequest(row: PaymentRequestRow | undefined): PaymentRequest | null {
  return row ? {
    id: row.id, publicToken: row.public_token, amountCents: row.amount_cents, platformFeeCents: row.platform_fee_cents,
    description: row.description, clientEmail: row.client_email, currency: row.currency, status: row.status,
    refundedAmountCents: row.refunded_amount_cents, applicationFeeRefundedCents: row.application_fee_refunded_cents,
    stripeCheckoutSessionId: row.stripe_checkout_session_id, stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeChargeId: row.stripe_charge_id, stripeApplicationFeeId: row.stripe_application_fee_id,
    paidAt: row.paid_at, sitterId: row.sitter_id, businessName: row.business_name,
    stripeAccountId: row.stripe_account_id, stripeReady: row.stripe_ready,
  } : null;
}

export async function getPaymentRequest(publicToken: string): Promise<PaymentRequest | null> {
  const [row] = await db()<PaymentRequestRow[]>`select pr.*, s.business_name, s.stripe_account_id, s.stripe_ready from payment_requests pr join sitters s on s.id = pr.sitter_id where pr.public_token = ${publicToken}`;
  return mapPaymentRequest(row);
}

export async function getPaymentRequestById(id: string): Promise<PaymentRequest | null> {
  const [row] = await db()<PaymentRequestRow[]>`select pr.*, s.business_name, s.stripe_account_id, s.stripe_ready from payment_requests pr join sitters s on s.id = pr.sitter_id where pr.id = ${id}::uuid`;
  return mapPaymentRequest(row);
}

export function toPaymentState(request: PaymentRequest): PaymentState {
  if (!request.stripeAccountId) throw new Error("Payment request sitter has no Stripe account");
  return {
    requestId: request.id, sitterStripeAccountId: request.stripeAccountId, amountCents: request.amountCents,
    currency: request.currency, status: request.status, refundedAmountCents: request.refundedAmountCents,
    stripeCheckoutSessionId: request.stripeCheckoutSessionId, stripePaymentIntentId: request.stripePaymentIntentId,
    stripeChargeId: request.stripeChargeId,
  };
}

export const formatMoney = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
