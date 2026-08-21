import { db } from "@/lib/db";
import { getOrigin, getStripe } from "@/lib/stripe";
import { getSitterProfileUrl, SITTER_SERVICE_DESCRIPTION } from "@/lib/sitter-profile";

export type StripeReadinessSitter = { id: string; stripeAccountId: string | null; stripeReady: boolean };
type ReadinessDependencies = {
  retrieve: (accountId: string) => Promise<{ configuration?: { merchant?: { capabilities?: { card_payments?: { status?: string } } } } }>;
  persist: (sitterId: string, ready: boolean) => Promise<unknown>;
};

export function buildConnectedAccountParams(sitter: { id: string; email: string; businessName: string }) {
  return {
    contact_email: sitter.email,
    display_name: sitter.businessName,
    identity: { country: "US" },
    dashboard: "full" as const,
    defaults: {
      profile: {
        business_url: getSitterProfileUrl(sitter.id),
        doing_business_as: sitter.businessName,
        product_description: SITTER_SERVICE_DESCRIPTION,
      },
      responsibilities: { fees_collector: "stripe" as const, losses_collector: "stripe" as const },
    },
    configuration: { merchant: { capabilities: { card_payments: { requested: true } } } },
    metadata: { directpaw_sitter_id: sitter.id },
    include: ["configuration.merchant" as const, "defaults" as const],
  };
}

export async function syncConnectedAccountProfile(
  stripeAccountId: string,
  sitter: { id: string; businessName: string },
): Promise<void> {
  await getStripe().v2.core.accounts.update(stripeAccountId, {
    defaults: {
      profile: {
        business_url: getSitterProfileUrl(sitter.id),
        doing_business_as: sitter.businessName,
        product_description: SITTER_SERVICE_DESCRIPTION,
      },
    },
  });
}

export async function refreshStripeReadiness(sitter: StripeReadinessSitter, dependencies?: ReadinessDependencies): Promise<boolean> {
  if (!sitter.stripeAccountId) return false;
  try {
    const account = dependencies
      ? await dependencies.retrieve(sitter.stripeAccountId)
      : await getStripe().v2.core.accounts.retrieve(sitter.stripeAccountId, { include: ["configuration.merchant"] });
    const ready = account.configuration?.merchant?.capabilities?.card_payments?.status === "active";
    if (ready !== sitter.stripeReady) {
      if (dependencies) await dependencies.persist(sitter.id, ready);
      else await db()`update sitters set stripe_ready = ${ready} where id = ${sitter.id}::uuid`;
    }
    return ready;
  } catch (error) {
    console.error("Unable to verify Stripe connected-account readiness", { sitterId: sitter.id, error: error instanceof Error ? error.message : "Unknown Stripe error" });
    return false;
  }
}

export async function createStripeOnboardingLink(stripeAccountId: string): Promise<string> {
  const link = await getStripe().v2.core.accountLinks.create({
    account: stripeAccountId,
    use_case: {
      type: "account_onboarding",
      account_onboarding: {
        configurations: ["merchant"],
        collection_options: { fields: "eventually_due" },
        refresh_url: `${getOrigin()}/api/connect/refresh`,
        return_url: `${getOrigin()}/api/connect/return`,
      },
    },
  });
  return link.url;
}
