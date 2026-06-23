import { NextResponse } from "next/server";
import { getSession, clearSession } from "@/lib/auth/session";
import { umLogout } from "@/lib/auth/um";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  if (session) await umLogout(session.accessToken); // best-effort: destroy the auth_stores row
  await clearSession();
  return NextResponse.json({ ok: true });
}
