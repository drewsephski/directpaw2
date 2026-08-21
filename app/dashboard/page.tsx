import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSitter } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/payment-requests";
import { refreshStripeReadiness } from "@/lib/stripe-connect";
import { SignOutButton } from "@/app/dashboard/SignOutButton";

export const dynamic = "force-dynamic";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ created?: string; error?: string; onboarding?: string }> }) {
  const sitter = await getCurrentSitter();
  if (!sitter) redirect("/");
  const stripeReady = sitter.stripeAccountId ? await refreshStripeReadiness(sitter) : false;
  const query = await searchParams;
  const requests = await db()<Array<{ public_token: string; amount_cents: number; description: string; status: string; created_at: Date }>>
    `select public_token, amount_cents, description, status, created_at from payment_requests where sitter_id = ${sitter.id}::uuid order by created_at desc limit 20`;
  return <main className="min-h-screen px-6 py-8 lg:px-12">
    <nav className="mx-auto flex max-w-6xl items-center justify-between border-b border-ink/20 pb-5"><Link href="/dashboard" className="text-xl font-black">DirectPaw</Link><SignOutButton /></nav>
    <div className="mx-auto max-w-6xl py-10">
      <p className="text-sm text-ink/55">{sitter.email}</p><h1 className="mt-1 text-4xl font-black tracking-tight">{sitter.businessName}</h1>
      {(query.error || query.onboarding) && <p className="mt-6 border border-ink/20 bg-white p-4" role="status">{query.error ?? (query.onboarding === "complete" ? "Stripe is connected. You can now request payments." : query.onboarding === "expired" ? "That onboarding link expired. Start again below." : "Stripe is reviewing your details. Payment requests unlock when card payments are active.")}</p>}
      {query.created && <p className="mt-6 border border-leaf bg-mint p-4">Payment link created: <Link className="font-bold underline" href={`/pay/${query.created}`}>{`${process.env.DOMAIN ?? "http://localhost:4242"}/pay/${query.created}`}</Link></p>}
      <div className="mt-10 grid gap-8 lg:grid-cols-2">
        <section className="border border-ink bg-white p-7">
          <p className="text-xs font-bold uppercase tracking-[.16em] text-leaf">Step 1</p><h2 className="mt-2 text-2xl font-bold">Connect Stripe</h2>
          <p className="mt-3 text-sm leading-6 text-ink/65">Stripe securely collects identity and bank details, manages payouts, and gives you a full Stripe Dashboard.</p>
          <div className="mt-5 flex items-center gap-3"><span className={`h-2.5 w-2.5 ${stripeReady ? "bg-leaf" : "bg-coral"}`} /><span className="text-sm font-bold">{stripeReady ? "Ready for card payments" : sitter.stripeAccountId ? "Onboarding in progress" : "Not connected"}</span></div>
          {!stripeReady && <form action="/api/connect/onboard" method="post" className="mt-6"><button className="w-full border border-ink bg-ink px-5 py-3 font-bold text-white hover:bg-leaf">{sitter.stripeAccountId ? "Continue Stripe setup" : "Connect Stripe"}</button></form>}
        </section>
        <section className={`border border-ink bg-white p-7 ${!stripeReady ? "opacity-60" : ""}`}>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-leaf">Step 2</p><h2 className="mt-2 text-2xl font-bold">Request payment</h2>
          <form action="/api/payment-requests" method="post" className="mt-5 space-y-4">
            <Field label="Amount (USD)" name="amount" inputMode="decimal" placeholder="75.00" disabled={!stripeReady} />
            <Field label="Description" name="description" placeholder="Overnight sitting — Aug 22–24" disabled={!stripeReady} />
            <Field label="Client email (optional)" name="clientEmail" type="email" disabled={!stripeReady} required={false} />
            <button disabled={!stripeReady} className="w-full border border-leaf bg-leaf px-5 py-3 font-bold text-white hover:bg-ink disabled:cursor-not-allowed disabled:bg-ink/40">Create payment link</button>
          </form>
        </section>
      </div>
      <section className="mt-8 border border-ink bg-white"><h2 className="border-b border-ink/20 p-5 text-xl font-bold">Recent requests</h2>{requests.length ? <div className="divide-y divide-ink/15">{requests.map((item) => <Link href={`/pay/${item.public_token}`} key={item.public_token} className="grid gap-1 p-5 hover:bg-mint/50 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-6"><span className="font-bold">{item.description}</span><span>{formatMoney(item.amount_cents)}</span><span className="text-xs font-bold uppercase tracking-wider text-ink/55">{item.status}</span></Link>)}</div> : <p className="p-5 text-sm text-ink/55">No payment requests yet.</p>}</section>
    </div>
  </main>;
}

function Field({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block text-sm font-bold">{label}<input required {...props} className="mt-2 w-full border border-ink/30 px-3 py-3 font-normal outline-none focus:border-leaf disabled:bg-ink/5" /></label>; }
