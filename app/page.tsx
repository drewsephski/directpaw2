import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentSitter } from "@/lib/auth";
import { AuthForms } from "@/app/AuthForms";

export default async function Home() {
  if (await getCurrentSitter()) redirect("/dashboard");
  return <main className="min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-9">
    <nav className="mx-auto flex max-w-6xl items-center justify-between border-b border-ink/10 pb-5">
      <Link href="/" className="text-xl font-extrabold tracking-[-.03em] text-leaf">DirectPaw</Link>
      <span className="hidden text-sm font-medium text-ink/60 sm:block">Payments for independent pet sitters</span>
    </nav>
    <section className="mx-auto grid max-w-6xl gap-12 py-12 sm:py-16 lg:grid-cols-[1.08fr_.82fr] lg:items-center lg:gap-20 lg:py-20">
      <div>
        <h1 className="max-w-3xl text-5xl font-extrabold leading-[.98] tracking-[-.04em] text-balance sm:text-7xl">A simpler way to get paid for pet care.</h1>
        <p className="mt-7 max-w-xl text-lg font-medium leading-8 text-ink/68">Create a payment request, send one secure link, and let Stripe deposit the money into your account. DirectPaw costs 3% per payment with no monthly subscription.</p>
        <div className="mt-10 flex max-w-xl flex-wrap gap-x-8 gap-y-5 border-t border-ink/12 pt-6">
          {[["3%", "per payment"], ["$0", "monthly fee"], ["You", "own the client"]].map(([value, label]) => <div key={label} className="min-w-28"><strong className="block text-2xl font-extrabold tracking-[-.03em] text-leaf">{value}</strong><span className="text-xs font-semibold text-ink/55">{label}</span></div>)}
        </div>
      </div>
      <div className="rounded-2xl bg-white p-6 shadow-[0_18px_55px_-28px_rgba(23,35,29,.42)] ring-1 ring-ink/8 sm:p-8">
        <h2 className="text-2xl font-extrabold tracking-[-.025em]">Start taking payments</h2>
        <p className="mt-2 text-sm font-medium leading-6 text-ink/60">Create an account, then connect your Stripe account.</p>
        <AuthForms />
      </div>
    </section>
  </main>;
}
