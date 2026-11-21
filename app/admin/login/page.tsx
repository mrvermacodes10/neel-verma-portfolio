"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Button, Field, inputCls } from "@/components/admin/ui";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setError(error.message === "Invalid login credentials" ? "Incorrect email or password." : error.message);
      setBusy(false);
      return;
    }
    window.location.assign("/admin");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <form onSubmit={submit} className="w-full max-w-sm">
        <div className="label text-stone">Neel Verma</div>
        <h1 className="mt-3 font-display text-4xl">Admin</h1>
        <div className="mt-2 h-px w-full bg-line" />
        {!isSupabaseConfigured ? (
          <p className="mt-8 text-sm leading-relaxed text-graphite">Supabase isn’t configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see the README).</p>
        ) : (
          <div className="mt-8 space-y-5">
            <Field label="Email">
              <input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Password">
              <input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
            </Field>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <Button type="submit" busy={busy} className="w-full">Sign in</Button>
            <p className="text-xs leading-relaxed text-stone">Private area. Accounts are created by the site owner in Supabase — there is no public sign-up.</p>
          </div>
        )}
      </form>
    </main>
  );
}
