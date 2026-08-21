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
  }} className="text-sm font-bold hover:text-leaf disabled:opacity-60">{pending ? "Signing out…" : "Sign out"}</button>;
}
