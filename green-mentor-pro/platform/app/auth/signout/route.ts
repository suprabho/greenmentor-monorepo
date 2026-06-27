import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Clears the Supabase session and returns to the login screen. */
export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  // 303 so the browser issues a GET to /login after the POST.
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
