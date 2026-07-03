"use client";

import { useState } from "react";
import { GoogleLogo, Spinner } from "@phosphor-icons/react";
import { createClient } from "@/lib/supabase/client";

/** Google OAuth sign-in button. Kicks off the Supabase OAuth redirect dance. */
export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(initialError ?? "");

  async function signInWithGoogle() {
    setLoading(true);
    setError("");
    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (error) {
      // On success the browser navigates away to Google, so we only land here
      // when the redirect itself failed to start.
      setError(error.message);
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button
        onClick={signInWithGoogle}
        disabled={loading}
        className="flex w-full items-center justify-center gap-2.5 rounded-pill border border-gray-200 bg-white px-4 py-3 text-[13.5px] font-semibold text-ink transition-shadow hover:shadow-soft disabled:opacity-60"
      >
        {loading ? (
          <Spinner size={18} className="animate-spin" />
        ) : (
          <GoogleLogo size={18} weight="bold" />
        )}
        {loading ? "Redirecting…" : "Continue with Google"}
      </button>
      {error && (
        <p className="rounded-[10px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{error}</p>
      )}
    </div>
  );
}
