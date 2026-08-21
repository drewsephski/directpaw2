"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForms() {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent<HTMLFormElement>, mode: "sign-up" | "sign-in") {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const result = mode === "sign-up"
      ? await authClient.signUp.email({ email, password, name: String(form.get("businessName") ?? "").trim() })
      : await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(mode === "sign-in" ? "Invalid email or password." : "Could not create the account. Check your details and try again.");
      setPending(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return <>
    {error && <p className="mt-5 border border-coral bg-coral/10 p-3 text-sm" role="alert">{error}</p>}
    <form onSubmit={(event) => submit(event, "sign-up")} className="mt-6 space-y-4">
      <Field label="Business name" name="businessName" autoComplete="organization" minLength={2} maxLength={100} />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} hint="At least 12 characters" />
      <button disabled={pending} className="w-full border border-leaf bg-leaf px-5 py-3 font-bold text-white hover:bg-ink disabled:opacity-60">{pending ? "Please wait…" : "Create account"}</button>
    </form>
    <details className="mt-7 border-t border-ink/15 pt-5">
      <summary className="cursor-pointer text-sm font-bold">Already have an account?</summary>
      <form onSubmit={(event) => submit(event, "sign-in")} className="mt-4 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" maxLength={128} />
        <button disabled={pending} className="w-full border border-ink px-5 py-3 font-bold hover:bg-mint disabled:opacity-60">{pending ? "Please wait…" : "Sign in"}</button>
      </form>
    </details>
  </>;
}

function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="block text-sm font-bold">{label}<input required {...props} className="mt-2 w-full border border-ink/30 bg-white px-3 py-3 font-normal outline-none focus:border-leaf focus:ring-2 focus:ring-leaf/20" />{hint && <span className="mt-1 block text-xs font-normal text-ink/50">{hint}</span>}</label>;
}
