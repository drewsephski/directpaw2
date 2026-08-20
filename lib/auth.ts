import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "directpaw_session";

export type Sitter = { id: string; email: string; businessName: string; stripeAccountId: string | null; stripeReady: boolean };

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(sitterId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  await db()`insert into sitter_sessions (sitter_id, token_hash, expires_at)
    values (${sitterId}::uuid, ${hashToken(token)}, now() + interval '30 days')`;
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production",
    path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db()`delete from sitter_sessions where token_hash = ${hashToken(token)}`;
  jar.delete(SESSION_COOKIE);
}

export async function getCurrentSitter(): Promise<Sitter | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [row] = await db()<Array<{ id: string; email: string; business_name: string; stripe_account_id: string | null; stripe_ready: boolean }>>
    `select s.id, s.email, s.business_name, s.stripe_account_id, s.stripe_ready
     from sitter_sessions ss join sitters s on s.id = ss.sitter_id
     where ss.token_hash = ${hashToken(token)} and ss.expires_at > now()`;
  return row ? { id: row.id, email: row.email, businessName: row.business_name, stripeAccountId: row.stripe_account_id, stripeReady: row.stripe_ready } : null;
}
