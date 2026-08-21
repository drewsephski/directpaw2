import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { SITTER_SERVICE_DESCRIPTION } from "@/lib/sitter-profile";

export const dynamic = "force-dynamic";

type PublicSitter = {
  business_name: string;
  email: string;
};

async function getPublicSitter(id: string): Promise<PublicSitter | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const [sitter] = await db()<PublicSitter[]>`
    select business_name, email
    from sitters
    where id = ${id}::uuid
  `;
  return sitter ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const sitter = await getPublicSitter((await params).id);
  if (!sitter) return { title: "Pet sitter not found — DirectPaw" };
  return {
    title: `${sitter.business_name} — Pet-care services`,
    description: SITTER_SERVICE_DESCRIPTION,
  };
}

export default async function SitterProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const sitter = await getPublicSitter((await params).id);
  if (!sitter) notFound();

  return (
    <main className="min-h-screen px-5 py-7 sm:px-8 lg:px-12 lg:py-9">
      <nav className="mx-auto flex max-w-4xl items-center justify-between border-b border-ink/10 pb-5">
        <Link href="/" className="text-xl font-extrabold tracking-[-.03em] text-leaf">DirectPaw</Link>
        <span className="hidden text-sm font-medium text-ink/60 sm:block">Independent pet-care provider</span>
      </nav>
      <article className="mx-auto max-w-4xl py-12 sm:py-16">
        <h1 className="max-w-3xl text-5xl font-extrabold leading-[1.02] tracking-[-.04em] text-balance sm:text-6xl">{sitter.business_name}</h1>
        <p className="mt-7 max-w-2xl text-lg font-medium leading-8 text-ink/68">{SITTER_SERVICE_DESCRIPTION}</p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl bg-white p-7 shadow-[0_14px_40px_-30px_rgba(23,35,29,.5)] ring-1 ring-ink/8">
            <h2 className="text-xl font-extrabold tracking-[-.02em]">Contact</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">Questions about services, scheduling, cancellations, or refunds should be sent directly to the provider.</p>
            <a className="mt-5 inline-block font-bold text-leaf underline" href={`mailto:${sitter.email}`}>{sitter.email}</a>
          </section>
          <section className="rounded-2xl bg-white p-7 shadow-[0_14px_40px_-30px_rgba(23,35,29,.5)] ring-1 ring-ink/8">
            <h2 className="text-xl font-extrabold tracking-[-.02em]">Payments</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">Clients receive a payment request after agreeing on the services and price. Card payments are processed securely by Stripe for {sitter.business_name}.</p>
          </section>
          <section className="rounded-2xl bg-white p-7 shadow-[0_14px_40px_-30px_rgba(23,35,29,.5)] ring-1 ring-ink/8 md:col-span-2">
            <h2 className="text-xl font-extrabold tracking-[-.02em]">Cancellations and refunds</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">The cancellation and refund terms agreed between the provider and client before payment apply to each service. Contact {sitter.business_name} at the email above to request a cancellation or refund or to resolve a payment dispute.</p>
          </section>
        </div>

        <p className="mt-10 border-t border-ink/20 pt-6 text-xs leading-5 text-ink/50">{sitter.business_name} provides the pet-care services and is responsible for service delivery, cancellations, and refunds. DirectPaw provides payment-request software and does not provide pet care or hold sitter funds.</p>
      </article>
    </main>
  );
}
