import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  stripeInstance ??= new Stripe(apiKey, {
    // Stripe.js 20.2.0's generated literal lags the current API release.
    // @ts-expect-error The API accepts this newer version before the SDK type catches up.
    apiVersion: "2026-06-24.dahlia",
    appInfo: { name: "DirectPaw", version: "0.1.0" },
  });
  return stripeInstance;
}

export function getOrigin(): string {
  return (process.env.DOMAIN ?? "http://localhost:4242").replace(/\/$/, "");
}
