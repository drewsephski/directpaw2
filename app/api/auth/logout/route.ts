import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";
import { rejectCrossOrigin } from "@/lib/http";
import { getOrigin } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossOrigin(request); if (rejected) return rejected;
  await destroySession();
  return NextResponse.redirect(getOrigin(), 303);
}
