import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/http";
import { getPaymentRequest } from "@/lib/payment-requests";
import { getOrigin, getStripe } from "@/lib/stripe";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  const { token } = await params;
  const paymentRequest = await getPaymentRequest(token);
  if (!paymentRequest || paymentRequest.status !== "open" || !paymentRequest.stripeAccountId || !paymentRequest.stripeReady) return NextResponse.redirect(`${getOrigin()}/pay/${token}?error=unavailable`, 303);
  const account = await getStripe().v2.core.accounts.retrieve(paymentRequest.stripeAccountId, { include: ["configuration.merchant"] });
  if (account.configuration?.merchant?.capabilities?.card_payments?.status !== "active") {
    return NextResponse.redirect(`${getOrigin()}/pay/${token}?error=unavailable`, 303);
  }
  const parameters = {
    mode: "payment" as const, integration_identifier: "directpaw_kxqmtzpa",
    line_items: [{ price_data: { currency: "usd", unit_amount: paymentRequest.amountCents, product_data: { name: paymentRequest.description } }, quantity: 1 }],
    payment_intent_data: { application_fee_amount: Math.round(paymentRequest.amountCents * 0.03) },
    customer_email: paymentRequest.clientEmail ?? undefined,
    metadata: { paymentRequestId: paymentRequest.id },
    success_url: `${getOrigin()}/pay/${token}/success`, cancel_url: `${getOrigin()}/pay/${token}`,
  } as Stripe.Checkout.SessionCreateParams & { integration_identifier: string };
  const session = await getStripe().checkout.sessions.create(parameters, { stripeAccount: paymentRequest.stripeAccountId, idempotencyKey: `directpaw-payment-request-${paymentRequest.id}` });
  if (!session.url) return NextResponse.json({ error: "Stripe did not return a Checkout URL" }, { status: 502 });
  return NextResponse.redirect(session.url, 303);
}
