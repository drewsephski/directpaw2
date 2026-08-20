import { NextResponse } from "next/server";
import { getCurrentSitter } from "@/lib/auth";
import { db } from "@/lib/db";
import { getOrigin, getStripe } from "@/lib/stripe";

export async function GET() {
  const sitter = await getCurrentSitter();
  if (!sitter?.stripeAccountId) return NextResponse.redirect(`${getOrigin()}/`, 303);
  const account = await getStripe().v2.core.accounts.retrieve(sitter.stripeAccountId, { include: ["configuration.merchant"] });
  const ready = account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
  await db()`update sitters set stripe_ready = ${ready} where id = ${sitter.id}::uuid`;
  return NextResponse.redirect(`${getOrigin()}/dashboard?onboarding=${ready ? "complete" : "pending"}`, 303);
}
