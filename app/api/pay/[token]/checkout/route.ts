import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/http";
import { getPaymentRequest } from "@/lib/payment-requests";
import { getOrigin, getStripe } from "@/lib/stripe";
import { refreshStripeReadiness } from "@/lib/stripe-connect";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  const { token } = await params;
  const paymentRequest = await getPaymentRequest(token);
  if (!paymentRequest || paymentRequest.status !== "open" || !paymentRequest.stripeAccountId || !paymentRequest.stripeReady) return NextResponse.redirect(`${getOrigin()}/pay/${token}?error=unavailable`, 303);
  if (!(await refreshStripeReadiness({ id: paymentRequest.sitterId, email: "", businessName: paymentRequest.businessName, stripeAccountId: paymentRequest.stripeAccountId, stripeReady: paymentRequest.stripeReady }))) {
    return NextResponse.redirect(`${getOrigin()}/pay/${token}?error=unavailable`, 303);
  }
  const parameters: Stripe.Checkout.SessionCreateParams = {
    mode: "payment" as const,
    payment_method_types: ["card"],
    client_reference_id: paymentRequest.id,
    line_items: [{ price_data: { currency: paymentRequest.currency, unit_amount: paymentRequest.amountCents, product_data: { name: paymentRequest.description } }, quantity: 1 }],
    payment_intent_data: { application_fee_amount: paymentRequest.platformFeeCents, metadata: { paymentRequestId: paymentRequest.id } },
    customer_email: paymentRequest.clientEmail ?? undefined,
    metadata: { paymentRequestId: paymentRequest.id },
    success_url: `${getOrigin()}/pay/${token}/success?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${getOrigin()}/pay/${token}`,
  };
  const session = await getStripe().checkout.sessions.create(parameters, { stripeAccount: paymentRequest.stripeAccountId, idempotencyKey: `directpaw-payment-request-${paymentRequest.id}` });
  if (!session.url) return NextResponse.json({ error: "Stripe did not return a Checkout URL" }, { status: 502 });
  return NextResponse.redirect(session.url, 303);
}
