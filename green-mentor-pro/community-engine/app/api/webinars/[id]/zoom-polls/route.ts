/**
 * Zoom-native poll results for a webinar.
 *
 * GET  → the stored answers (webinar_zoom_poll_answers), read by the Zoom
 *        polls section of the webinar's expanded row.
 * POST → sync: pull GET /past_meetings/{zoom_meeting_number}/polls from the
 *        Zoom API, resolve respondent emails back to platform accounts, and
 *        replace this webinar's stored rows. Zoom exposes results only after
 *        the meeting ends (no poll webhooks, no live endpoint), so this is a
 *        manual post-session action — same workflow as the attendance CSV
 *        import next to it.
 *
 * Same admin-allowlist gate + service-role access as the other webinar
 * routes, with the usual graceful modes: no service key → unconfigured, no
 * Zoom S2S credentials → zoom-unconfigured.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { fetchPastMeetingPollAnswers, isZoomApiConfigured, ZoomApiError } from "@/lib/zoom/api";
import { listZoomPollAnswers, replaceZoomPollAnswers } from "@/lib/db/webinar-zoom-polls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ answers: [] });

  try {
    const { id } = await params;
    const answers = await listZoomPollAnswers(createAdminClient(), id);
    return NextResponse.json({ answers });
  } catch (e) {
    return NextResponse.json(
      { error: `Could not load Zoom poll results: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  if (!isZoomApiConfigured()) {
    return NextResponse.json(
      {
        error:
          "Zoom API access isn't configured — set ZOOM_S2S_ACCOUNT_ID, ZOOM_S2S_CLIENT_ID and ZOOM_S2S_CLIENT_SECRET from a Server-to-Server OAuth app.",
        mode: "zoom-unconfigured",
      },
      { status: 503 }
    );
  }

  const { id } = await params;
  const admin = createAdminClient();

  const { data: webinar, error } = await admin
    .from("community_webinars")
    .select("id, zoom_meeting_number")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!webinar) return NextResponse.json({ error: "webinar not found" }, { status: 404 });
  if (!webinar.zoom_meeting_number) {
    return NextResponse.json(
      { error: "This webinar has no Zoom meeting number, so there's nothing to sync from." },
      { status: 400 }
    );
  }

  try {
    const answers = await fetchPastMeetingPollAnswers(String(webinar.zoom_meeting_number));
    if (answers.length === 0) {
      // Nothing to store — and never wipe what an earlier sync brought in.
      return NextResponse.json({
        ok: true,
        imported: 0,
        message:
          "Zoom returned no poll answers for this meeting yet. Results appear a few minutes after the meeting ends; anything already synced was left untouched.",
      });
    }
    const result = await replaceZoomPollAnswers(admin, id, answers);
    return NextResponse.json({ ok: true, imported: result.inserted, ...result });
  } catch (e) {
    if (e instanceof ZoomApiError) {
      return NextResponse.json({ error: e.message }, { status: e.status === 404 ? 404 : 502 });
    }
    return NextResponse.json({ error: `Sync failed: ${(e as Error).message}` }, { status: 500 });
  }
}
