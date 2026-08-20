import { db } from "@/lib/db";

export type PaymentRequest = {
  id: string; publicToken: string; amountCents: number; description: string; clientEmail: string | null;
  status: "open" | "paid" | "refunded" | "disputed"; stripeCheckoutSessionId: string | null;
  paidAt: Date | null; sitterId: string; businessName: string; stripeAccountId: string | null; stripeReady: boolean;
};

export async function getPaymentRequest(publicToken: string): Promise<PaymentRequest | null> {
  const [row] = await db()<Array<{ id: string; public_token: string; amount_cents: number; description: string; client_email: string | null; status: PaymentRequest["status"]; stripe_checkout_session_id: string | null; paid_at: Date | null; sitter_id: string; business_name: string; stripe_account_id: string | null; stripe_ready: boolean }>>
    `select pr.*, s.business_name, s.stripe_account_id, s.stripe_ready
     from payment_requests pr join sitters s on s.id = pr.sitter_id where pr.public_token = ${publicToken}`;
  return row ? {
    id: row.id, publicToken: row.public_token, amountCents: row.amount_cents, description: row.description,
    clientEmail: row.client_email, status: row.status, stripeCheckoutSessionId: row.stripe_checkout_session_id,
    paidAt: row.paid_at, sitterId: row.sitter_id, businessName: row.business_name,
    stripeAccountId: row.stripe_account_id, stripeReady: row.stripe_ready,
  } : null;
}

export const formatMoney = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
