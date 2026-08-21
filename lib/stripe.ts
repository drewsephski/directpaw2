import Stripe from "stripe";
import { getApplicationOrigin } from "@/lib/origin";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) throw new Error("STRIPE_SECRET_KEY is not configured");
  stripeInstance ??= new Stripe(apiKey, {
    apiVersion: "2026-07-29.dahlia",
    appInfo: { name: "DirectPaw", version: "0.1.0" },
  });
  return stripeInstance;
}

export function getOrigin(): string {
  return getApplicationOrigin();
}
