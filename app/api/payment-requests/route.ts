import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSitter } from "@/lib/auth";
import { db } from "@/lib/db";
import { rejectCrossOrigin } from "@/lib/http";
import { getOrigin } from "@/lib/stripe";

const schema = z.object({
  amount: z.string().regex(/^\d{1,7}(\.\d{1,2})?$/).transform((v) => Math.round(Number(v) * 100)).pipe(z.number().int().min(100).max(1_000_000)),
  description: z.string().trim().min(3).max(200),
  clientEmail: z.union([z.literal(""), z.email()]).transform((v) => v ? v.toLowerCase() : null),
});

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  const sitter = await getCurrentSitter();
  if (!sitter) return NextResponse.redirect(getOrigin(), 303);
  if (!sitter.stripeReady) return NextResponse.redirect(`${getOrigin()}/dashboard?error=${encodeURIComponent("Complete Stripe onboarding before creating a payment request.")}`, 303);
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return NextResponse.redirect(`${getOrigin()}/dashboard?error=${encodeURIComponent("Enter a valid amount, description, and optional email.")}`, 303);
  const token = randomBytes(18).toString("base64url");
  await db()`insert into payment_requests (sitter_id, public_token, amount_cents, description, client_email)
    values (${sitter.id}::uuid, ${token}, ${parsed.data.amount}, ${parsed.data.description}, ${parsed.data.clientEmail})`;
  return NextResponse.redirect(`${getOrigin()}/dashboard?created=${token}`, 303);
}
