import { NextResponse } from "next/server";
import { getOrigin } from "@/lib/stripe";
export function GET() { return NextResponse.redirect(`${getOrigin()}/dashboard?onboarding=expired`, 303); }
