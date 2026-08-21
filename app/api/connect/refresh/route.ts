import { NextResponse } from "next/server";
import { getCurrentSitter } from "@/lib/auth";
import { getOrigin } from "@/lib/stripe";
import { createStripeOnboardingLink } from "@/lib/stripe-connect";

export async function GET() {
  const sitter = await getCurrentSitter();
  if (!sitter?.stripeAccountId) return NextResponse.redirect(`${getOrigin()}/?error=${encodeURIComponent("Sign in to continue Stripe onboarding.")}`, 303);
  return NextResponse.redirect(await createStripeOnboardingLink(sitter.stripeAccountId), 303);
}
