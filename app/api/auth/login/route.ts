import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { rejectCrossOrigin } from "@/lib/http";
import { getOrigin } from "@/lib/stripe";

const schema = z.object({ email: z.email().transform((v) => v.toLowerCase()), password: z.string().min(1).max(128) });

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  const parsed = schema.safeParse(Object.fromEntries(await request.formData()));
  if (parsed.success) {
    const [sitter] = await db()<Array<{ id: string; password_hash: string }>>
      `select id, password_hash from sitters where email = ${parsed.data.email}`;
    if (sitter && await verifyPassword(parsed.data.password, sitter.password_hash)) {
      await createSession(sitter.id);
      return NextResponse.redirect(`${getOrigin()}/dashboard`, 303);
    }
  }
  return NextResponse.redirect(`${getOrigin()}/?error=${encodeURIComponent("Invalid email or password.")}`, 303);
}
