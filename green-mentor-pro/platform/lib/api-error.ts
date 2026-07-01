import { NextResponse } from "next/server";

/**
 * Turn a thrown error into a JSON 500 response. Client fetches in the AI Hub call
 * `res.json()` unconditionally, so an unhandled throw (which Next renders as an
 * HTML error page) surfaces in the UI as "Unexpected token '<'". Wrapping route
 * bodies with this keeps the response JSON and shows the real cause instead —
 * e.g. a missing SUPABASE_SERVICE_ROLE_KEY (see @gm/orchestrator createAdminClient).
 */
export function jsonError(e: unknown, status = 500): NextResponse {
  const message = e instanceof Error ? e.message : String(e);
  return NextResponse.json({ error: message }, { status });
}
