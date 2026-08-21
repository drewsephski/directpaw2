import { NextRequest, NextResponse } from "next/server";
import { rejectCrossOrigin } from "@/lib/http";
import { getPaymentRequest } from "@/lib/payment-requests";
import { createOrReuseCheckoutSession } from "@/lib/checkout";
import { getOrigin } from "@/lib/stripe";
import { refreshStripeReadiness } from "@/lib/stripe-connect";

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  const { token } = await params;
  const paymentRequest = await getPaymentRequest(token);
  if (!paymentRequest || paymentRequest.status !== "open" || !paymentRequest.stripeAccountId) return NextResponse.redirect(`${getOrigin()}/pay/${token}?error=unavailable`, 303);
  if (!(await refreshStripeReadiness({ id: paymentRequest.sitterId, stripeAccountId: paymentRequest.stripeAccountId, stripeReady: paymentRequest.stripeReady }))) {
    return NextResponse.redirect(`${getOrigin()}/pay/${token}?error=unavailable`, 303);
  }
  try {
    const result = await createOrReuseCheckoutSession(token);
    return NextResponse.redirect(result.kind === "paid" ? `${getOrigin()}/pay/${token}/success?session_id=${result.sessionId}` : result.url, 303);
  } catch (error) {
    console.error("Unable to prepare Stripe Checkout", { paymentRequestId: paymentRequest.id, error: error instanceof Error ? error.message : "Unknown error" });
    return NextResponse.redirect(`${getOrigin()}/pay/${token}?error=unavailable`, 303);
  }
}
