import { NextResponse } from "next/server";
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
  const nextParam = searchParams.get("next") ?? "/";
  // Only allow same-origin relative redirects.
  const next = nextParam.startsWith("/") ? nextParam : "/";
  const errorDescription = searchParams.get("error_description");

  const loginWithError = (msg: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  if (errorDescription) return loginWithError(errorDescription);
  if (!code) return loginWithError("No authorization code returned");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return loginWithError(error.message);

  return NextResponse.redirect(`${origin}${next}`);
}
