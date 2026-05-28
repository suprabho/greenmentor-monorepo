import { NextResponse } from "next/server";

/**
 * v2 SSO endpoint placeholder.
 *
 * When implemented, this will:
 *   1. Read `email`, `name`, `segment`, and `planId` from the request
 *   2. Call the Learnyst SSO API to create / upsert the user
 *   3. Return a one-time-use authenticated URL on the Learnyst school
 *
 * Until then, callers should rely on `buildHandoffUrl` from
 * `lib/learnyst/client.ts` which sends prefill query params.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: false,
      error: "Not implemented",
      message:
        "v1 uses a soft Learnyst handoff. The SSO endpoint will be wired in v2.",
    },
    { status: 501 },
  );
}

export async function POST() {
  return NextResponse.json(
    {
      ok: false,
      error: "Not implemented",
      message:
        "v1 uses a soft Learnyst handoff. The SSO endpoint will be wired in v2.",
    },
    { status: 501 },
  );
}
