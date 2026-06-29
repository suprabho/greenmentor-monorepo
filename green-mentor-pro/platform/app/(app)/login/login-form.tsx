"use client";

import { useState } from "react";
import { GoogleLogo, Spinner } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

/** Email/password + Google OAuth sign-in for the platform. */
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");
  const [notice, setNotice] = useState("");

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    const supabase = createClient();

    if (mode === "signup") {
      // New accounts go through onboarding first.
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/onboarding")}` },
      });
      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }
      // Auto-confirm on → session is live; else the user must confirm by email.
      if (data.session) {
        window.location.href = "/onboarding";
        return;
      }
      setNotice("Account created. Check your email to confirm, then sign in.");
      setMode("signin");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.location.href = next;
  }

  return (
    <div className="space-y-3 text-left">
      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-pill border border-gray-200 bg-white px-4 py-3 text-[13.5px] font-semibold text-ink transition-shadow hover:shadow-soft disabled:opacity-60"
      >
        {loading ? <Spinner size={18} className="animate-spin" /> : <GoogleLogo size={18} weight="bold" />}
        Continue with Google
      </button>

      <div className="flex items-center gap-3 py-1 text-[11px] text-gray-400">
        <span className="h-px flex-1 bg-gray-200" /> or <span className="h-px flex-1 bg-gray-200" />
      </div>

      <form onSubmit={submitEmail} className="space-y-2.5">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full rounded-[10px] border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-teal-700"
        />
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          className="w-full rounded-[10px] border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-[13.5px] outline-none focus:border-teal-700"
        />
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-pill bg-teal-900 px-4 py-3 text-[13.5px] font-semibold text-white hover:bg-teal-800 disabled:opacity-60"
        >
          {loading && <Spinner size={16} className="animate-spin" />}
          {mode === "signin" ? "Sign in" : "Create account"}
        </button>
      </form>

      <button
        onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(""); setNotice(""); }}
        className="w-full text-center text-[12.5px] text-gray-600 hover:text-ink"
      >
        {mode === "signin" ? "New here? Create an account" : "Have an account? Sign in"}
      </button>

      {notice && <p className="rounded-[10px] bg-green-50 px-3 py-2 text-[12.5px] text-green-700">{notice}</p>}
      {error && <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>}
    </div>
  );
}
