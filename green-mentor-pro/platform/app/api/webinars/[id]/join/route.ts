/**
 * POST → "this learner clicked through to Zoom". Pinged (fire-and-forget) by
 * the live room's hand-off card (components/webinars/zoom-join-card.tsx) when
 * a join link is clicked — the same moment the zoom-signature route used to
 * record for the embedded player. With the session running in Zoom's own app
 * or web client, a click is the only in-app join signal left; how long they
 * actually stayed comes from the admin's Zoom participant-report import,
 * which merges onto the same webinar_attendance rows.
 *
 * Shaped like the heartbeat route: authenticate, hand off to
 * recordWebinarJoin (countJoin=true bumps join_count), always answer 200 with
 * an `ok` flag — attendance is analytics and must never disturb a join.
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
  const ok = await recordWebinarJoin(id, user, { countJoin: true });
  return NextResponse.json({ ok });
}
