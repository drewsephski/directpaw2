import { NextRequest, NextResponse } from "next/server";
import { getOrigin } from "@/lib/stripe";

export function rejectCrossOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  if (origin && origin !== getOrigin()) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }
  return null;
}

export const errorMessage = (error: unknown) => error instanceof Error ? error.message : "Unexpected error";
