import { describe, expect, test } from "bun:test";
import { buildConnectedAccountParams } from "@/lib/stripe-connect";

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
  });
});
