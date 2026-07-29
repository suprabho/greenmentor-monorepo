import { NextResponse } from "next/server";
import { searchAll } from "@/lib/search/repo";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";

// GET /api/search?q=… — global search behind the ⌘K palette.
//
// Deliberately no 401: search degrades to publicly-readable content when
// signed out (RLS decides what that is) and reports `limitedBySignIn` so the
// palette can offer a sign-in prompt instead of silently showing less.
//
// The jsonError wrapper matters more than usual here. The palette calls
// res.json() on every response, so an unhandled throw — which Next renders as
// an HTML error page — would surface as "Unexpected token '<'" rather than the
// real cause. Same failure mode the AI Hub already got bitten by.
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const results = await searchAll(q);
    return NextResponse.json(results);
  } catch (e) {
    return jsonError(e);
  }
}
