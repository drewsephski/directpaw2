import { betterAuth } from "better-auth";
import { PostgresJSDialect } from "kysely-postgres-js";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/password";

const origin = process.env.BETTER_AUTH_URL ?? process.env.DOMAIN ?? "http://localhost:4242";

export const auth = betterAuth({
  appName: "DirectPaw",
  baseURL: origin,
  database: { dialect: new PostgresJSDialect({ postgres: db() }), type: "postgres", transaction: true },
  trustedOrigins: [origin],
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: true,
    password: { hash: hashPassword, verify: ({ password, hash }) => verifyPassword(password, hash) },
  },
  user: {
    modelName: "sitters",
    fields: { name: "business_name", emailVerified: "email_verified", image: "image", createdAt: "created_at", updatedAt: "updated_at" },
    additionalFields: {
      stripeAccountId: { type: "string", required: false, input: false, fieldName: "stripe_account_id" },
      stripeReady: { type: "boolean", required: true, defaultValue: false, input: false, fieldName: "stripe_ready" },
    },
  },
  session: {
    modelName: "auth_sessions",
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    fields: { userId: "user_id", expiresAt: "expires_at", ipAddress: "ip_address", userAgent: "user_agent", createdAt: "created_at", updatedAt: "updated_at" },
  },
  account: {
    modelName: "auth_accounts",
    fields: {
      accountId: "account_id", providerId: "provider_id", userId: "user_id", accessToken: "access_token",
      refreshToken: "refresh_token", idToken: "id_token", accessTokenExpiresAt: "access_token_expires_at",
      refreshTokenExpiresAt: "refresh_token_expires_at", createdAt: "created_at", updatedAt: "updated_at",
    },
  },
  verification: {
    modelName: "auth_verifications",
    fields: { expiresAt: "expires_at", createdAt: "created_at", updatedAt: "updated_at" },
  },
  rateLimit: {
    enabled: true,
    storage: "database",
    modelName: "auth_rate_limits",
    fields: { lastRequest: "last_request" },
    customRules: { "/sign-in/email": { window: 60, max: 5 }, "/sign-up/email": { window: 60, max: 3 } },
  },
  advanced: {
    cookiePrefix: "directpaw",
    useSecureCookies: process.env.NODE_ENV === "production",
    database: { generateId: "uuid" },
  },
});

export type Sitter = { id: string; email: string; businessName: string; stripeAccountId: string | null; stripeReady: boolean };

export async function getCurrentSitter(): Promise<Sitter | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    businessName: session.user.name,
    stripeAccountId: session.user.stripeAccountId ?? null,
    stripeReady: session.user.stripeReady,
  };
}
