import Stripe from "stripe";
import type postgres from "postgres";
import { db } from "@/lib/db";
import { getOrigin, getStripe } from "@/lib/stripe";

type CheckoutRow = {
  id: string; public_token: string; amount_cents: number; platform_fee_cents: number; description: string;
  client_email: string | null; currency: string; status: string; stripe_checkout_session_id: string | null;
  stripe_account_id: string | null;
};
type Transaction = postgres.TransactionSql;
export type CheckoutResult = { kind: "open"; sessionId: string; url: string } | { kind: "paid"; sessionId: string };

export type CheckoutSnapshot = {
  id: string; status: string | null; paymentStatus: string; url: string | null; clientReferenceId: string | null;
  paymentRequestId: string | null; amountTotal: number | null; currency: string | null;
};

export function checkoutLifecycleDecision(row: Pick<CheckoutRow, "id" | "amount_cents" | "currency">, session: CheckoutSnapshot): "reuse" | "paid" | "replace" {
  if (session.clientReferenceId !== row.id || session.paymentRequestId !== row.id) throw new Error("Checkout Session does not belong to this payment request");
  if (session.amountTotal !== row.amount_cents || session.currency?.toLowerCase() !== row.currency) throw new Error("Checkout Session amount or currency does not match");
  if (session.status === "open") {
    if (!session.url) throw new Error("Open Checkout Session has no URL");
    return "reuse";
  }
  if (session.status === "complete" && session.paymentStatus === "paid") return "paid";
  if (session.status === "expired") return "replace";
  throw new Error("Checkout Session is not payable");
}

function snapshot(session: Stripe.Checkout.Session): CheckoutSnapshot {
  return {
    id: session.id, status: session.status, paymentStatus: session.payment_status, url: session.url,
    clientReferenceId: session.client_reference_id, paymentRequestId: session.metadata?.paymentRequestId ?? null,
    amountTotal: session.amount_total, currency: session.currency,
  };
}

function createParameters(row: CheckoutRow): Stripe.Checkout.SessionCreateParams {
  return {
    mode: "payment",
    client_reference_id: row.id,
    line_items: [{ price_data: { currency: row.currency, unit_amount: row.amount_cents, product_data: { name: row.description } }, quantity: 1 }],
    payment_intent_data: { application_fee_amount: row.platform_fee_cents, metadata: { paymentRequestId: row.id } },
    customer_email: row.client_email ?? undefined,
    metadata: { paymentRequestId: row.id },
    success_url: `${getOrigin()}/pay/${row.public_token}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${getOrigin()}/pay/${row.public_token}`,
  };
}

async function createAndPersist(sql: Transaction, row: CheckoutRow, idempotencyKey: string): Promise<CheckoutResult> {
  const session = await getStripe().checkout.sessions.create(createParameters(row), { stripeAccount: row.stripe_account_id!, idempotencyKey });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  await sql`update payment_requests set stripe_checkout_session_id = ${session.id}, updated_at = now() where id = ${row.id}::uuid`;
  return { kind: "open", sessionId: session.id, url: session.url };
}

export async function createOrReuseCheckoutSession(publicToken: string): Promise<CheckoutResult> {
  return db().begin(async (sql) => {
    await sql`select pg_advisory_xact_lock(hashtext(${publicToken}))`;
    const [row] = await sql<CheckoutRow[]>`select pr.*, s.stripe_account_id from payment_requests pr join sitters s on s.id = pr.sitter_id where pr.public_token = ${publicToken} for update of pr`;
    if (!row || row.status !== "open" || !row.stripe_account_id) throw new Error("Payment request is not available");
    if (!row.stripe_checkout_session_id) return createAndPersist(sql, row, `directpaw-checkout-${row.id}`);

    const existing = await getStripe().checkout.sessions.retrieve(row.stripe_checkout_session_id, {}, { stripeAccount: row.stripe_account_id });
    const decision = checkoutLifecycleDecision(row, snapshot(existing));
    if (decision === "reuse") return { kind: "open", sessionId: existing.id, url: existing.url! };
    if (decision === "paid") return { kind: "paid", sessionId: existing.id };
    return createAndPersist(sql, row, `directpaw-checkout-${row.id}-after-${existing.id}`);
  });
}
