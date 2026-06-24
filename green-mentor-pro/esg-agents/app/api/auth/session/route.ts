import { NextResponse } from "next/server";
import { getSession, publicSession } from "@/lib/auth/session";

export const runtime = "nodejs";

/** Non-secret session projection for client UI (org name, email, role, FY). No tokens. */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  return NextResponse.json({ authenticated: true, ...publicSession(session) });
}
