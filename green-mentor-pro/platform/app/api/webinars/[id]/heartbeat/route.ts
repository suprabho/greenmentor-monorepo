/**
 * POST → "this learner is still watching". Pinged by the embedded Zoom player
 * (components/webinars/zoom-embed.tsx) on an interval while joined, so
 * webinar_attendance.last_seen_at reflects how long they actually stayed rather
 * than only that they clicked Join. The admin hub shows first-joined → last-seen
 * as an in-app watch window.
 *
 * Deliberately thin: authenticate, then hand off to recordWebinarJoin with
 * countJoin=false so the ping moves last_seen_at without inflating join_count.
 * Always answers 200 with an `ok` flag — a heartbeat is not something the client
 * should retry or surface, and a failed one must never disturb a live session.
 */

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { recordWebinarJoin } from "@/lib/webinars/attendance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

  const { id } = await params;
  const ok = await recordWebinarJoin(id, user, { countJoin: false });
  return NextResponse.json({ ok });
}
