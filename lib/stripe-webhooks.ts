import Stripe from "stripe";
import type postgres from "postgres";
import { db } from "@/lib/db";
import { applyPaymentSignal, calculateApplicationFeeRefundTargetCents, type PaymentSignal, type PaymentState, type PaymentStatus } from "@/lib/payments";
import { getStripe } from "@/lib/stripe";

type ReconciliationRow = {
  id: string; amount_cents: number; platform_fee_cents: number; currency: string; status: PaymentStatus;
  refunded_amount_cents: number; application_fee_refunded_cents: number; stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null; stripe_charge_id: string | null; stripe_application_fee_id: string | null;
  stripe_account_id: string;
};

type StripeObjects = { requestId: string; paymentIntentId: string; charge: Stripe.Charge; applicationFeeId: string | null };
type DbTransaction = postgres.TransactionSql;

const objectId = (value: string | { id: string } | null) => typeof value === "string" ? value : value?.id ?? null;

async function retrieveStripeObjects(accountId: string, paymentIntent: string | Stripe.PaymentIntent | null, charge: string | Stripe.Charge | null): Promise<StripeObjects> {
  let intent = typeof paymentIntent === "object" && paymentIntent ? paymentIntent : null;
  const paymentIntentId = objectId(paymentIntent);
  if (!intent && paymentIntentId) intent = await getStripe().paymentIntents.retrieve(paymentIntentId, { expand: ["latest_charge.application_fee"] }, { stripeAccount: accountId });
  if (!intent) throw new Error("Stripe event has no PaymentIntent");
  const requestId = intent.metadata.paymentRequestId;
  if (!requestId) throw new Error("PaymentIntent has no DirectPaw request metadata");

  let resolvedCharge: Stripe.Charge | null = null;
  const chargeId = objectId(charge) ?? objectId(intent.latest_charge);
  if (chargeId) resolvedCharge = await getStripe().charges.retrieve(chargeId, { expand: ["application_fee"] }, { stripeAccount: accountId });
  if (!resolvedCharge) throw new Error("PaymentIntent has no Charge");
  if (objectId(resolvedCharge.payment_intent) !== intent.id) throw new Error("Charge does not belong to the reconciled PaymentIntent");

  let applicationFeeId = objectId(resolvedCharge.application_fee);
  if (!applicationFeeId) {
    const fees = await getStripe().applicationFees.list({ charge: resolvedCharge.id, limit: 1 });
    applicationFeeId = fees.data[0]?.id ?? null;
  }
  return { requestId, paymentIntentId: intent.id, charge: resolvedCharge, applicationFeeId };
}

function toState(row: ReconciliationRow): PaymentState {
  return {
    requestId: row.id, sitterStripeAccountId: row.stripe_account_id, amountCents: row.amount_cents,
    currency: row.currency, status: row.status, refundedAmountCents: row.refunded_amount_cents,
    stripeCheckoutSessionId: row.stripe_checkout_session_id, stripePaymentIntentId: row.stripe_payment_intent_id,
    stripeChargeId: row.stripe_charge_id,
  };
}

async function loadLockedRequest(sql: DbTransaction, requestId: string): Promise<ReconciliationRow> {
  await sql`select pg_advisory_xact_lock(hashtext(${requestId}))`;
  const [row] = await sql<ReconciliationRow[]>`
    select pr.*, s.stripe_account_id from payment_requests pr join sitters s on s.id = pr.sitter_id
    where pr.id = ${requestId}::uuid for update of pr`;
  if (!row?.stripe_account_id) throw new Error("No DirectPaw request exists for this Stripe object");
  return row;
}

async function persistState(sql: DbTransaction, state: PaymentState, applicationFeeId: string | null, applicationFeeRefundedCents: number, paidAtUnix?: number): Promise<void> {
  await sql`update payment_requests set status = ${state.status}, refunded_amount_cents = ${state.refundedAmountCents},
    application_fee_refunded_cents = ${applicationFeeRefundedCents},
    stripe_checkout_session_id = ${state.stripeCheckoutSessionId}, stripe_payment_intent_id = ${state.stripePaymentIntentId},
    stripe_charge_id = ${state.stripeChargeId}, stripe_application_fee_id = coalesce(${applicationFeeId}, stripe_application_fee_id),
    paid_at = coalesce(paid_at, ${paidAtUnix ? new Date(paidAtUnix * 1000) : null}), updated_at = now()
    where id = ${state.requestId}::uuid`;
}

async function reconcileApplicationFeeRefund(row: ReconciliationRow, charge: Stripe.Charge, applicationFeeId: string | null): Promise<{ feeId: string; refundedCents: number }> {
  if (!applicationFeeId) throw new Error("Application fee is not available yet; Stripe should retry this event");
  const fee = await getStripe().applicationFees.retrieve(applicationFeeId);
  if (objectId(fee.account) !== row.stripe_account_id || objectId(fee.charge) !== charge.id || fee.amount !== row.platform_fee_cents || fee.currency !== row.currency) throw new Error("Application fee does not match this DirectPaw payment");
  const target = calculateApplicationFeeRefundTargetCents(row.platform_fee_cents, row.amount_cents, charge.amount_refunded);
  if (fee.amount_refunded > target) throw new Error("Stripe application fee refund exceeds the expected cumulative target");
  const delta = target - fee.amount_refunded;
  if (delta > 0) await getStripe().applicationFees.createRefund(fee.id, { amount: delta }, { idempotencyKey: `directpaw-fee-refund-${fee.id}-${target}` });
  return { feeId: fee.id, refundedCents: target };
}

export async function processStripeEvent(event: Stripe.Event): Promise<void> {
  const accountId = typeof event.account === "string" ? event.account : null;
  const handled = ["checkout.session.completed", "charge.refunded", "charge.dispute.created", "charge.dispute.closed"].includes(event.type);
  if (handled && !accountId) throw new Error("Expected a connected-account Stripe event");

  if (!handled) {
    await db()`insert into stripe_webhook_events (event_id, event_type) values (${event.id}, ${event.type}) on conflict (event_id) do nothing`;
    return;
  }

  let requestId: string;
  let signal: PaymentSignal;
  let applicationFeeId: string | null = null;
  let applicationFeeRefundedCents: number | null = null;
  let paidAtUnix: number | undefined;
  let resolvedCharge: Stripe.Charge;

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    requestId = session.metadata?.paymentRequestId ?? "";
    if (!requestId || session.client_reference_id !== requestId || session.payment_status !== "paid" || session.status !== "complete") throw new Error("Checkout Session is not a completed DirectPaw payment");
    const objects = await retrieveStripeObjects(accountId!, typeof session.payment_intent === "string" ? session.payment_intent : null, null);
    if (objects.requestId !== requestId) throw new Error("Checkout and PaymentIntent metadata disagree");
    applicationFeeId = objects.applicationFeeId;
    resolvedCharge = objects.charge;
    paidAtUnix = objects.charge.created;
    signal = { kind: "checkout", requestId, stripeAccountId: accountId!, amountCents: session.amount_total ?? -1, currency: session.currency ?? "", checkoutSessionId: session.id, paymentIntentId: objects.paymentIntentId, chargeId: objects.charge.id };
  } else if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const objects = await retrieveStripeObjects(accountId!, charge.payment_intent, charge);
    requestId = objects.requestId; applicationFeeId = objects.applicationFeeId; resolvedCharge = objects.charge; paidAtUnix = charge.created;
    signal = { kind: "refund", requestId, stripeAccountId: accountId!, amountCents: charge.amount, currency: charge.currency, paymentIntentId: objects.paymentIntentId, chargeId: charge.id, refundedAmountCents: charge.amount_refunded };
  } else {
    const eventDispute = event.data.object as Stripe.Dispute;
    const dispute = await getStripe().disputes.retrieve(eventDispute.id, {}, { stripeAccount: accountId! });
    const objects = await retrieveStripeObjects(accountId!, dispute.payment_intent, dispute.charge);
    requestId = objects.requestId; applicationFeeId = objects.applicationFeeId; resolvedCharge = objects.charge; paidAtUnix = objects.charge.created;
    const disputeOutcome = dispute.status === "lost" ? "lost" as const : ["won", "prevented", "warning_closed"].includes(dispute.status) ? "won" as const : undefined;
    signal = { kind: disputeOutcome ? "dispute_closed" : "dispute_created", requestId, stripeAccountId: accountId!, amountCents: objects.charge.amount, currency: objects.charge.currency, paymentIntentId: objects.paymentIntentId, chargeId: objects.charge.id, disputeOutcome };
    if (event.type === "charge.dispute.closed" && !signal.disputeOutcome) throw new Error(`Unsupported closed dispute status: ${dispute.status}`);
  }

  await db().begin(async (sql) => {
    const duplicate = await sql`select event_id from stripe_webhook_events where event_id = ${event.id}`;
    if (duplicate.length) return;
    const row = await loadLockedRequest(sql, requestId);
    let current = toState(row);
    if (resolvedCharge.amount_refunded > current.refundedAmountCents) {
      current = applyPaymentSignal(current, { kind: "refund", requestId, stripeAccountId: accountId!, amountCents: resolvedCharge.amount, currency: resolvedCharge.currency, paymentIntentId: objectId(resolvedCharge.payment_intent) ?? undefined, chargeId: resolvedCharge.id, refundedAmountCents: resolvedCharge.amount_refunded });
    }
    const next = applyPaymentSignal(current, signal);
    if (resolvedCharge.amount_refunded > 0) {
      const feeRefund = await reconcileApplicationFeeRefund(row, resolvedCharge, applicationFeeId);
      applicationFeeId = feeRefund.feeId; applicationFeeRefundedCents = feeRefund.refundedCents;
    }
    await persistState(sql, next, applicationFeeId, applicationFeeRefundedCents ?? row.application_fee_refunded_cents, paidAtUnix);
    await sql`insert into stripe_webhook_events (event_id, event_type) values (${event.id}, ${event.type})`;
  });
}
