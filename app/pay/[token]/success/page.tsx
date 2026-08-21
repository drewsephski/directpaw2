import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentRequest, toPaymentState } from "@/lib/payment-requests";
import { validatePaidCheckoutSession } from "@/lib/payments";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export default async function Success({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ session_id?: string }> }) {
  const { token } = await params;
  const { session_id: sessionId } = await searchParams;
  const paymentRequest = await getPaymentRequest(token);
  if (!paymentRequest) notFound();

  let verified = false;
  if (sessionId && paymentRequest.stripeAccountId) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(sessionId, {}, { stripeAccount: paymentRequest.stripeAccountId });
      validatePaidCheckoutSession(toPaymentState(paymentRequest), {
        id: session.id, stripeAccountId: paymentRequest.stripeAccountId, paymentStatus: session.payment_status, status: session.status,
        clientReferenceId: session.client_reference_id, paymentRequestId: session.metadata?.paymentRequestId ?? null,
        amountTotal: session.amount_total, currency: session.currency,
      });
      verified = true;
    } catch {
      verified = false;
    }
  }

  return <main className="flex min-h-screen items-center justify-center px-5 py-12"><div className="max-w-lg rounded-2xl bg-white p-8 text-center shadow-[0_20px_60px_-30px_rgba(23,35,29,.5)] ring-1 ring-ink/8 sm:p-10">
    <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full text-2xl font-bold ${verified ? "bg-mint text-leaf" : "bg-coral/15 text-coral"}`}>{verified ? "✓" : "!"}</div>
    <h1 className="mt-6 text-3xl font-extrabold tracking-[-.025em] text-balance">{verified ? "Stripe confirmed your payment." : "Payment not confirmed."}</h1>
    <p className="mt-4 leading-7 text-ink/65">{verified ? "DirectPaw is waiting for Stripe's signed webhook to persist the final status." : "This link does not include a valid paid Checkout Session for this payment request. No success is being claimed."}</p>
    <Link href={`/pay/${token}`} className="mt-7 inline-block font-bold text-leaf underline">View payment status</Link>
  </div></main>;
}
