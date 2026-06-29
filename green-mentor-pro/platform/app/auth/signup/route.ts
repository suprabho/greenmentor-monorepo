import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Email/password sign-up that skips email confirmation. Instead of the browser
 * client's `auth.signUp` (which is gated by the project's "Confirm email"
 * setting), we create the user server-side with the service-role key and
 * `email_confirm: true`, so the account is usable immediately. The browser then
 * signs in with the same credentials to establish the session.
 *
 * Runs server-side only — the service-role key never reaches the client.
 */
export async function POST(request: Request) {
  let email: unknown;
  let password: unknown;
  try {
    ({ email, password } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });

  if (error) {
    // Most common: the email is already registered. Surface a friendly hint.
    const already = /already.*registered|already.*exists/i.test(error.message);
    return NextResponse.json(
      { error: already ? "That email is already registered — try signing in." : error.message },
      { status: already ? 409 : 400 },
    );
  }

  return NextResponse.json({ ok: true });
}
