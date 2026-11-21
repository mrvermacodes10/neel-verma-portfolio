"use client";
import Link from "next/link";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { ToastProvider } from "./ui";

export function AdminShell({ email, authorised, children }: { email: string; authorised: boolean; children: React.ReactNode }) {
  const [leaving, setLeaving] = useState(false);
  const signOut = async () => {
    setLeaving(true);
    await supabaseBrowser().auth.signOut();
    window.location.assign("/admin/login");
  };
  return (
    <ToastProvider>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-[2px]">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-4 px-4 sm:px-6">
            <Link href="/admin" className="label !tracking-[0.24em] text-ink">Admin</Link>
            <span className="hidden truncate text-xs text-stone sm:inline">{email}</span>
            <div className="ml-auto flex items-center gap-5">
              <a href="/" target="_blank" rel="noopener" className="label link-line text-ink">View site ↗</a>
              <button onClick={signOut} disabled={leaving} className="label link-line text-ink disabled:opacity-40">Sign out</button>
            </div>
          </div>
        </header>
        {authorised ? (
          <main className="mx-auto max-w-5xl px-4 pb-32 pt-8 sm:px-6 sm:pt-12">{children}</main>
        ) : (
          <main className="mx-auto max-w-md px-5 py-24">
            <h1 className="font-display text-3xl">Not authorised</h1>
            <p className="mt-4 text-sm leading-relaxed text-graphite">
              You’re signed in as {email}, but this account isn’t an admin. Add it to the <code>public.admins</code> table (see <code>supabase/make-admin.sql</code>) or sign in with your admin account.
            </p>
          </main>
        )}
      </div>
    </ToastProvider>
  );
}
