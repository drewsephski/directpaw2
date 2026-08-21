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
    <main className="min-h-screen px-6 py-10 lg:px-12">
      <nav className="mx-auto flex max-w-4xl items-center justify-between border-b border-ink/20 pb-5">
        <Link href="/" className="text-xl font-black tracking-tight">DirectPaw</Link>
        <span className="text-sm text-ink/60">Independent pet-care provider</span>
      </nav>
      <article className="mx-auto max-w-4xl py-14">
        <p className="text-sm font-bold uppercase tracking-[.18em] text-leaf">Pet sitting and pet care</p>
        <h1 className="mt-3 text-5xl font-black tracking-[-.04em]">{sitter.business_name}</h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-ink/70">{SITTER_SERVICE_DESCRIPTION}</p>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          <section className="border border-ink bg-white p-7">
            <h2 className="text-xl font-bold">Contact</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">Questions about services, scheduling, cancellations, or refunds should be sent directly to the provider.</p>
            <a className="mt-5 inline-block font-bold text-leaf underline" href={`mailto:${sitter.email}`}>{sitter.email}</a>
          </section>
          <section className="border border-ink bg-white p-7">
            <h2 className="text-xl font-bold">Payments</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">Clients receive a payment request after agreeing on the services and price. Card payments are processed securely by Stripe for {sitter.business_name}.</p>
          </section>
          <section className="border border-ink bg-white p-7 md:col-span-2">
            <h2 className="text-xl font-bold">Cancellations and refunds</h2>
            <p className="mt-3 text-sm leading-6 text-ink/65">The cancellation and refund terms agreed between the provider and client before payment apply to each service. Contact {sitter.business_name} at the email above to request a cancellation or refund or to resolve a payment dispute.</p>
          </section>
        </div>

        <p className="mt-10 border-t border-ink/20 pt-6 text-xs leading-5 text-ink/50">{sitter.business_name} provides the pet-care services and is responsible for service delivery, cancellations, and refunds. DirectPaw provides payment-request software and does not provide pet care or hold sitter funds.</p>
      </article>
    </main>
  );
}
