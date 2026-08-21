import { NextResponse } from "next/server";
import { getCurrentSitter } from "@/lib/auth";
import { getOrigin } from "@/lib/stripe";
import { refreshStripeReadiness } from "@/lib/stripe-connect";

export async function GET() {
  const sitter = await getCurrentSitter();
  if (!sitter?.stripeAccountId) return NextResponse.redirect(`${getOrigin()}/`, 303);
  const ready = await refreshStripeReadiness(sitter);
  return NextResponse.redirect(`${getOrigin()}/dashboard?onboarding=${ready ? "complete" : "pending"}`, 303);
}
