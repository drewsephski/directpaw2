import Link from "next/link";
import { notFound } from "next/navigation";
import { getPaymentRequest } from "@/lib/payment-requests";

export const dynamic = "force-dynamic";
export default async function Success({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params; const paymentRequest = await getPaymentRequest(token); if (!paymentRequest) notFound();
  return <main className="flex min-h-screen items-center justify-center px-6"><div className="max-w-lg border border-ink bg-white p-8 text-center shadow-[10px_10px_0_#dcebdd]"><div className="mx-auto flex h-14 w-14 items-center justify-center bg-mint text-2xl">✓</div><h1 className="mt-6 text-3xl font-black">Thanks—Stripe received your payment.</h1><p className="mt-4 leading-7 text-ink/65">DirectPaw confirms payment from Stripe’s signed webhook. If the status is still updating, it will appear on the payment page shortly.</p><Link href={`/pay/${token}`} className="mt-7 inline-block font-bold text-leaf underline">View payment status</Link></div></main>;
}
