import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSitter } from "@/lib/auth";

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getCurrentSitter()) redirect("/dashboard");
  const { error } = await searchParams;
  return <main className="min-h-screen px-6 py-10 lg:px-12">
    <nav className="mx-auto flex max-w-6xl items-center justify-between border-b border-ink/20 pb-5">
      <Link href="/" className="text-xl font-black tracking-tight">DirectPaw</Link>
      <span className="text-sm text-ink/60">Payments for independent pet sitters</span>
    </nav>
    <section className="mx-auto grid max-w-6xl gap-14 py-16 lg:grid-cols-[1.15fr_.85fr] lg:items-start">
      <div className="pt-6">
        <p className="mb-5 text-sm font-bold uppercase tracking-[.2em] text-leaf">Your clients. Your business.</p>
        <h1 className="max-w-3xl text-5xl font-black leading-[.96] tracking-[-.05em] sm:text-7xl">Get paid without chasing checks.</h1>
        <p className="mt-7 max-w-xl text-lg leading-8 text-ink/70">Create a payment request, send one secure link, and let Stripe deposit the money into your account. DirectPaw costs 3% per payment with no monthly subscription.</p>
        <div className="mt-10 grid max-w-xl grid-cols-3 border border-ink/20 bg-white">
          {[["3%", "per payment"], ["$0", "monthly fee"], ["You", "own the client"]].map(([value, label]) => <div key={label} className="border-r border-ink/20 p-4 last:border-0"><strong className="block text-2xl">{value}</strong><span className="text-xs text-ink/60">{label}</span></div>)}
        </div>
      </div>
      <div className="border border-ink bg-white p-7 shadow-[8px_8px_0_#dcebdd]">
        <h2 className="text-2xl font-bold">Start taking payments</h2>
        <p className="mt-2 text-sm text-ink/60">Create an account, then connect your Stripe account.</p>
        {error && <p className="mt-5 border border-coral bg-coral/10 p-3 text-sm" role="alert">{error}</p>}
        <form action="/api/auth/register" method="post" className="mt-6 space-y-4">
          <Field label="Business name" name="businessName" autoComplete="organization" />
          <Field label="Email" name="email" type="email" autoComplete="email" />
          <Field label="Password" name="password" type="password" autoComplete="new-password" hint="At least 12 characters" />
          <button className="w-full border border-leaf bg-leaf px-5 py-3 font-bold text-white hover:bg-ink">Create account</button>
        </form>
        <details className="mt-7 border-t border-ink/15 pt-5">
          <summary className="cursor-pointer text-sm font-bold">Already have an account?</summary>
          <form action="/api/auth/login" method="post" className="mt-4 space-y-4">
            <Field label="Email" name="email" type="email" autoComplete="email" />
            <Field label="Password" name="password" type="password" autoComplete="current-password" />
            <button className="w-full border border-ink px-5 py-3 font-bold hover:bg-mint">Sign in</button>
          </form>
        </details>
      </div>
    </section>
  </main>;
}

function Field({ label, hint, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="block text-sm font-bold">{label}<input required {...props} className="mt-2 w-full border border-ink/30 bg-white px-3 py-3 font-normal outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20" />{hint && <span className="mt-1 block text-xs font-normal text-ink/50">{hint}</span>}</label>;
}
