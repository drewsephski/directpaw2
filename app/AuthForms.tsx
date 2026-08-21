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
    try {
      const result = mode === "sign-up"
        ? await authClient.signUp.email({ email, password, name: String(form.get("businessName") ?? "").trim() })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(mode === "sign-in" ? "Invalid email or password." : "Could not create the account. Check your details and try again.");
        return;
      }
      const session = await authClient.getSession();
      if (session.error || !session.data) throw new Error("Session cookie was not established");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("DirectPaw could not complete authentication. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <>
    {error && <p className="mt-5 rounded-xl bg-coral/10 p-3 text-sm font-medium text-coral ring-1 ring-coral/25" role="alert">{error}</p>}
    <form onSubmit={(event) => submit(event, "sign-up")} className="mt-6 space-y-4">
      <Field label="Your name or pet-care business name" name="businessName" autoComplete="organization" minLength={2} maxLength={100} />
      <Field label="Email" name="email" type="email" autoComplete="email" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} hint="At least 12 characters" />
      <button disabled={pending} className="w-full bg-leaf px-5 py-3.5 font-bold text-white shadow-[0_8px_20px_-12px_rgba(35,100,72,.75)] hover:bg-ink disabled:cursor-wait disabled:opacity-60">{pending ? "Please wait…" : "Create account"}</button>
    </form>
    <details className="mt-7 border-t border-ink/15 pt-5">
      <summary className="cursor-pointer text-sm font-bold">Already have an account?</summary>
      <form onSubmit={(event) => submit(event, "sign-in")} className="mt-4 space-y-4">
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field label="Password" name="password" type="password" autoComplete="current-password" maxLength={128} />
        <button disabled={pending} className="w-full bg-mint px-5 py-3 font-bold text-ink ring-1 ring-leaf/20 hover:bg-leaf hover:text-white disabled:cursor-wait disabled:opacity-60">{pending ? "Please wait…" : "Sign in"}</button>
      </form>
    </details>
  </>;
}

function Field({ label, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return <label className="block text-sm font-bold">{label}<input required {...props} className="mt-2 w-full border border-ink/15 bg-cream/35 px-3.5 py-3 font-medium outline-none hover:border-ink/30 focus:border-leaf focus:bg-white focus:ring-3 focus:ring-leaf/12" />{hint && <span className="mt-1.5 block text-xs font-medium text-ink/50">{hint}</span>}</label>;
}
