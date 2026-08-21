import { describe, expect, test } from "bun:test";
import { buildConnectedAccountParams, refreshStripeReadiness } from "@/lib/stripe-connect";

describe("connected account creation", () => {
  test("sets the US identity before requesting the merchant configuration", () => {
    const params = buildConnectedAccountParams({
      id: "sitter-id",
      email: "sitter@example.com",
      businessName: "Good Dog Care",
    });

    expect(params.identity).toEqual({ country: "US" });
    expect(params.configuration.merchant.capabilities.card_payments.requested).toBe(true);
    expect(params.defaults.responsibilities).toEqual({ fees_collector: "stripe", losses_collector: "stripe" });
    expect(params.defaults.profile).toEqual({
      business_url: "http://localhost:4242/sitters/sitter-id",
      doing_business_as: "Good Dog Care",
      product_description: "Independent pet sitting and pet care services arranged directly with existing clients. Clients receive a DirectPaw payment request for agreed services and pay online by card.",
    });
  });
});

describe("connected account readiness", () => {
  test("heals a false cache when live card payments are active", async () => {
    const writes: boolean[] = [];
    const ready = await refreshStripeReadiness(
      { id: "sitter-id", stripeAccountId: "acct_sitter", stripeReady: false },
      {
        retrieve: async () => ({ configuration: { merchant: { capabilities: { card_payments: { status: "active" } } } } }),
        persist: async (_id, value) => writes.push(value),
      },
    );
    expect(ready).toBe(true);
    expect(writes).toEqual([true]);
  });

  test("fails closed without overwriting an active cache when Stripe is unavailable", async () => {
    const writes: boolean[] = [];
    const ready = await refreshStripeReadiness(
      { id: "sitter-id", stripeAccountId: "acct_sitter", stripeReady: true },
      { retrieve: async () => { throw new Error("temporary outage"); }, persist: async (_id, value) => writes.push(value) },
    );
    expect(ready).toBe(false);
    expect(writes).toEqual([]);
  });
});
