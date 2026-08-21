import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSitter } from "@/lib/auth";
import { AuthForms } from "@/app/AuthForms";

export default async function Home() {
  if (await getCurrentSitter()) redirect("/dashboard");
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
        <AuthForms />
      </div>
    </section>
  </main>;
}
