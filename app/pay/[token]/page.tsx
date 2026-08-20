import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, getPaymentRequest } from "@/lib/payment-requests";

export const dynamic = "force-dynamic";
export default async function PayPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params; const paymentRequest = await getPaymentRequest(token); if (!paymentRequest) notFound();
  const { error } = await searchParams;
  return <main className="flex min-h-screen items-center justify-center px-6 py-12"><div className="w-full max-w-lg border border-ink bg-white p-8 shadow-[10px_10px_0_#dcebdd]">
    <Link href="/" className="text-lg font-black">DirectPaw</Link><p className="mt-10 text-xs font-bold uppercase tracking-[.18em] text-leaf">Payment to</p><h1 className="mt-2 text-3xl font-black">{paymentRequest.businessName}</h1>
    <p className="mt-7 border-y border-ink/15 py-5 text-lg">{paymentRequest.description}</p><p className="mt-8 text-5xl font-black tracking-tight">{formatMoney(paymentRequest.amountCents)}</p>
    {error && <p className="mt-5 border border-coral bg-coral/10 p-3 text-sm">This payment is not currently available.</p>}
    {paymentRequest.status === "open" ? <form action={`/api/pay/${token}/checkout`} method="post" className="mt-8"><button className="w-full border border-leaf bg-leaf px-6 py-4 text-lg font-bold text-white hover:bg-ink">Pay securely with Stripe</button></form> : <p className="mt-8 border border-ink/20 bg-mint p-4 font-bold">This request is {paymentRequest.status}.</p>}
    <p className="mt-5 text-center text-xs leading-5 text-ink/50">Payment is processed by Stripe for {paymentRequest.businessName}. DirectPaw does not hold sitter funds.</p>
  </div></main>;
}
