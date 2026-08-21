import { describe, expect, test } from "bun:test";
import { hashPassword, verifyPassword } from "@/lib/password";

describe("password hashing", () => {
  test("round trips a password without storing plaintext", async () => {
    const hash = await hashPassword("a secure test password");
    expect(hash).not.toContain("a secure test password");
    expect(await verifyPassword("a secure test password", hash)).toBe(true);
    expect(await verifyPassword("the wrong password", hash)).toBe(false);
  });

  test("rejects malformed stored hashes", async () => {
    expect(await verifyPassword("anything", "not-a-valid-hash")).toBe(false);
  });
});
