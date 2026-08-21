import Link from "next/link";
import { notFound } from "next/navigation";
import { formatMoney, getPaymentRequest } from "@/lib/payment-requests";

export const dynamic = "force-dynamic";
export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const paymentRequest = await getPaymentRequest(token);
  if (!paymentRequest) notFound();
  const { error } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-[0_20px_60px_-30px_rgba(23,35,29,.5)] ring-1 ring-ink/8 sm:p-9">
        <Link href="/" className="text-lg font-extrabold tracking-[-.03em] text-leaf">
          DirectPaw
        </Link>
        <p className="mt-10 text-sm font-semibold text-ink/55">Payment to</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-.025em]">
          {paymentRequest.businessName}
        </h1>
        <p className="mt-7 border-y border-ink/15 py-5 text-lg">
          {paymentRequest.description}
        </p>
        <p className="mt-8 text-5xl font-extrabold tracking-[-.035em] tabular-nums">
          {formatMoney(paymentRequest.amountCents)}
        </p>
        {error && (
          <p className="mt-5 rounded-xl bg-coral/10 p-3 text-sm font-medium text-coral ring-1 ring-coral/25">
            This payment is not currently available.
          </p>
        )}
        {paymentRequest.status === "open" ? (
          <form
            action={`/api/pay/${token}/checkout`}
            method="post"
            className="mt-8"
          >
            <button className="w-full bg-leaf px-6 py-4 text-lg font-bold text-white shadow-[0_8px_20px_-12px_rgba(35,100,72,.75)] hover:bg-ink">
              Pay securely with Stripe
            </button>
          </form>
        ) : (
          <p className="mt-8 rounded-xl bg-mint p-4 font-bold text-leaf ring-1 ring-leaf/15">
            This request is {paymentRequest.status}.
          </p>
        )}
        <p className="mt-5 text-center text-xs leading-5 text-ink/50">
          Payment is processed by Stripe for {paymentRequest.businessName}.
          DirectPaw does not hold sitter funds.
        </p>
      </div>
    </main>
  );
}
