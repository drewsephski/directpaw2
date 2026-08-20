import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return NextResponse.json({ error: "Webhook verification is not configured" }, { status: 400 });
  let event: Stripe.Event;
  try { event = getStripe().webhooks.constructEvent(body, signature, secret); }
  catch { return NextResponse.json({ error: "Invalid webhook signature" }, { status: 400 }); }

  await db().begin(async (sql) => {
    const inserted = await sql<Array<{ event_id: string }>>
      `insert into stripe_webhook_events (event_id, event_type) values (${event.id}, ${event.type})
       on conflict (event_id) do nothing returning event_id`;
    if (!inserted.length) return;
    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const requestId = session.metadata?.paymentRequestId;
      const accountId = typeof event.account === "string" ? event.account : null;
      if (!requestId || !accountId || session.payment_status !== "paid") throw new Error("Incomplete Checkout event");
      const updated = await sql`
        update payment_requests pr set status = 'paid', stripe_checkout_session_id = ${session.id},
          stripe_payment_intent_id = ${typeof session.payment_intent === "string" ? session.payment_intent : null}, paid_at = now(), updated_at = now()
        from sitters s where pr.id = ${requestId}::uuid and pr.sitter_id = s.id
          and s.stripe_account_id = ${accountId} and pr.amount_cents = ${session.amount_total ?? -1} and pr.status = 'open'
        returning pr.id`;
      if (!updated.length) throw new Error("Checkout event did not match an open payment request");
    }
    if (event.type === "charge.refunded" || event.type === "charge.dispute.created") {
      const charge = event.data.object;
      const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
      const accountId = typeof event.account === "string" ? event.account : null;
      const shouldUpdate = event.type === "charge.dispute.created" || ("refunded" in charge && charge.refunded);
      if (intentId && accountId && shouldUpdate) await sql`
        update payment_requests pr set status = ${event.type === "charge.refunded" ? "refunded" : "disputed"}, updated_at = now()
        from sitters s where pr.sitter_id = s.id and pr.stripe_payment_intent_id = ${intentId} and s.stripe_account_id = ${accountId}`;
    }
  });
  return NextResponse.json({ received: true });
}
