import { NextResponse } from "next/server";
import { safeNextHref } from "@/lib/auth/next-href";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth redirect target. Exchanges the `code` from Supabase for a session
 * (stored in cookies), then sends the user on to `next`. The PKCE verifier was
 * set as a cookie by the browser client when the sign-in started, so the
 * exchange completes here on the server.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow same-origin relative redirects — safeNextHref also rejects the
  // protocol-relative "//evil.com" form that a bare startsWith("/") lets past.
  const next = safeNextHref(searchParams.get("next"), "/");
  const errorDescription = searchParams.get("error_description");

  const loginWithError = (msg: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  if (errorDescription) return loginWithError(errorDescription);
  if (!code) return loginWithError("No authorization code returned");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return loginWithError(error.message);

  // Send anyone who hasn't finished onboarding there first, whatever `next`
  // said. Without this an OAuth sign-up would land straight in the app — the
  // hardcoded redirect on the email/password path never covered Google.
  const userId = data?.user?.id;
  if (userId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarded")
      .eq("id", userId)
      .maybeSingle();
    // Explicit `=== false` so a missing row (migration not run) doesn't trap
    // the user in a flow whose columns don't exist yet.
    if (profile?.onboarded === false) {
      // Carry `next` through onboarding rather than dropping it — otherwise
      // everyone who signs up from a shared link finishes the wizard on /home
      // instead of the webinar/job/post that brought them here.
      const target = next === "/" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(next)}`;
      return NextResponse.redirect(`${origin}${target}`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
