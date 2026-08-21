"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const [pending, setPending] = useState(false);
  const router = useRouter();
  return <button disabled={pending} onClick={async () => {
    setPending(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }} className="rounded-lg px-3 py-2 text-sm font-bold hover:bg-mint/65 hover:text-leaf disabled:cursor-wait disabled:opacity-60">{pending ? "Signing out…" : "Sign out"}</button>;
}
