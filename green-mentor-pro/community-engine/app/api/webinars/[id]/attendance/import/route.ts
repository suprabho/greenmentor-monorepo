/**
 * POST → import a Zoom participant/attendee report CSV as attendance for a
 * webinar. Body { csv: string } — the file's text, read in the browser by the
 * People section's file input.
 *
 * This is the authoritative attendance path: in-app join logging only sees
 * learners who join through the platform's embedded player, while Zoom's report
 * covers everyone who was actually in the room. mergeZoomParticipants converges
 * the two onto one row per person, so re-importing is safe and importing after
 * people have already joined in-app doesn't double-count them.
 *
 * Same admin-allowlist gate + service-role write as the other webinar routes.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { mergeZoomParticipants } from "@/lib/db/webinar-people";
import { parseZoomParticipantCsv } from "@/lib/zoom/participant-csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Zoom reports are small (a few thousand rows at most); this only guards against
// someone dropping an unrelated multi-megabyte file into the input.
const MAX_CSV_BYTES = 5 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => ({}))) as { csv?: unknown };
  if (typeof body.csv !== "string" || body.csv.trim() === "") {
    return NextResponse.json({ error: "csv is required" }, { status: 400 });
  }
  if (body.csv.length > MAX_CSV_BYTES) {
    return NextResponse.json({ error: "that file is too large to be a Zoom report" }, { status: 413 });
  }

  const { participants, warnings } = parseZoomParticipantCsv(body.csv);
  if (participants.length === 0) {
    // Nothing usable — hand back the parser's reasons so the admin can tell a
    // wrong-file mistake from an empty session.
    return NextResponse.json(
      { error: warnings[0] ?? "No participants found in that file.", warnings },
      { status: 422 }
    );
  }

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  const { id } = await params;
  try {
    const result = await mergeZoomParticipants(createAdminClient(), id, participants);
    return NextResponse.json({ ok: true, imported: participants.length, ...result, warnings });
  } catch (e) {
    return NextResponse.json({ error: `Import failed: ${(e as Error).message}` }, { status: 500 });
  }
}
