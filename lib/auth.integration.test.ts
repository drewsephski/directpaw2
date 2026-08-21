import { afterAll, describe, expect, test } from "bun:test";
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";

const enabled = process.env.RUN_DB_TESTS === "1";
const integrationTest = enabled ? test : test.skip;
const email = `better-auth-${crypto.randomUUID()}@example.com`;
const password = "correct horse battery staple";
let sitterId: string | undefined;

function request(path: string, init: RequestInit = {}) {
  return auth.handler(new Request(`http://localhost:4242/api/auth${path}`, {
    ...init,
    headers: { origin: "http://localhost:4242", "content-type": "application/json", ...init.headers },
  }));
}

function sessionCookie(response: Response): string {
  const value = response.headers.get("set-cookie")?.split(";")[0];
  if (!value) throw new Error("Better Auth did not set a session cookie");
  return value;
}

describe("Better Auth with PostgreSQL", () => {
  integrationTest("sign-up, credential identity, session, sign-in, sign-out, and database rate limiting", async () => {
    const signUp = await request("/sign-up/email", { method: "POST", body: JSON.stringify({ name: "Integration Pet Care", email: email.toUpperCase(), password }) });
    expect(signUp.status).toBe(200);
    const signUpCookie = sessionCookie(signUp);

    const [sitter] = await db()<Array<{ id: string; email: string; password_hash_exists: boolean }>>`
      select id, email, to_jsonb(sitters) ? 'password_hash' as password_hash_exists from sitters where email = ${email}`;
    expect(sitter?.email).toBe(email);
    expect(sitter?.password_hash_exists).toBe(false);
    sitterId = sitter.id;

    const [account] = await db()<Array<{ issuer: string; account_id: string; provider_id: string; password: string | null }>>`
      select issuer, account_id, provider_id, password from auth_accounts where user_id = ${sitter.id}::uuid`;
    expect(account).toMatchObject({ issuer: "local:credential", account_id: sitter.id, provider_id: "credential" });
    expect(account.password).toBeTruthy();
    expect(account.password).not.toBe(password);

    const signedUpSession = await request("/get-session", { headers: { cookie: signUpCookie } });
    expect(signedUpSession.status).toBe(200);
    expect((await signedUpSession.json()).user.id).toBe(sitter.id);

    const signOut = await request("/sign-out", { method: "POST", headers: { cookie: signUpCookie }, body: "{}" });
    expect(signOut.status).toBe(200);
    const afterSignOut = await request("/get-session", { headers: { cookie: signUpCookie } });
    expect(await afterSignOut.json()).toBeNull();
    const [{ count: sessionCount }] = await db()<Array<{ count: number }>>`select count(*)::integer as count from auth_sessions where user_id = ${sitter.id}::uuid`;
    expect(sessionCount).toBe(0);

    const signIn = await request("/sign-in/email", { method: "POST", body: JSON.stringify({ email: email.toUpperCase(), password }) });
    expect(signIn.status).toBe(200);
    const signInCookie = sessionCookie(signIn);
    const signedInSession = await request("/get-session", { headers: { cookie: signInCookie } });
    expect((await signedInSession.json()).user.id).toBe(sitter.id);

    let limited: Response | undefined;
    for (let attempt = 0; attempt < 6; attempt++) {
      limited = await request("/sign-in/email", {
        method: "POST",
        headers: { "x-forwarded-for": "203.0.113.42" },
        body: JSON.stringify({ email, password: "deliberately wrong password" }),
      });
    }
    expect(limited?.status).toBe(429);
    const [{ count: rateLimitRows }] = await db()<Array<{ count: number }>>`select count(*)::integer as count from auth_rate_limits`;
    expect(rateLimitRows).toBeGreaterThan(0);
  });
});

afterAll(async () => {
  if (enabled && sitterId) await db()`delete from sitters where id = ${sitterId}::uuid`;
});
