import { getApplicationOrigin } from "@/lib/origin";

export const SITTER_SERVICE_DESCRIPTION =
  "Independent pet sitting and pet care services arranged directly with existing clients. Clients receive a DirectPaw payment request for agreed services and pay online by card.";

export function getSitterProfilePath(sitterId: string): string {
  return `/sitters/${sitterId}`;
}

export function getSitterProfileUrl(sitterId: string, origin = getApplicationOrigin()): string {
  return new URL(getSitterProfilePath(sitterId), origin).toString();
}
