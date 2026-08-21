import { NextRequest, NextResponse } from "next/server";
import { getCurrentSitter } from "@/lib/auth";
import { db } from "@/lib/db";
import { rejectCrossOrigin } from "@/lib/http";
import { getOrigin, getStripe } from "@/lib/stripe";
import { buildConnectedAccountParams, createStripeOnboardingLink } from "@/lib/stripe-connect";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  const sitter = await getCurrentSitter();
  if (!sitter) return NextResponse.redirect(`${getOrigin()}/`, 303);

  let accountId = sitter.stripeAccountId;
  if (!accountId) {
    const account = await getStripe().v2.core.accounts.create(
      buildConnectedAccountParams(sitter),
      { idempotencyKey: `directpaw-sitter-${sitter.id}` },
    );
    accountId = account.id;
    await db()`update sitters set stripe_account_id = ${accountId} where id = ${sitter.id}::uuid and stripe_account_id is null`;
  }

  return NextResponse.redirect(await createStripeOnboardingLink(accountId), 303);
}
