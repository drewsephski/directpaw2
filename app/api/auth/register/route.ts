import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword } from "@/lib/auth";
import { db } from "@/lib/db";
import { errorMessage, rejectCrossOrigin } from "@/lib/http";
import { getOrigin } from "@/lib/stripe";

const schema = z.object({
  businessName: z.string().trim().min(2).max(100),
  email: z.email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(128),
});

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  try {
    const input = schema.parse(Object.fromEntries(await request.formData()));
    const [sitter] = await db()<Array<{ id: string }>>
      `insert into sitters (email, business_name, password_hash)
       values (${input.email}, ${input.businessName}, ${await hashPassword(input.password)}) returning id`;
    await createSession(sitter.id);
    return NextResponse.redirect(`${getOrigin()}/dashboard`, 303);
  } catch (error) {
    const message = errorMessage(error).includes("sitters_email_key") ? "An account with that email already exists." : "Could not create account. Check your details and try again.";
    return NextResponse.redirect(`${getOrigin()}/?error=${encodeURIComponent(message)}`, 303);
  }
}
