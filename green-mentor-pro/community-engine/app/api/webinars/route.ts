/**
 * Webinars — the Academy's live webinar programme: scheduling, publishing to
 * the learner platform, and post-webinar funnel metrics.
 *
 * GET  → list every webinar plus RSVP counts (admin-only; `community_webinars`
 *        has RLS enabled with no policies, so this reads through the
 *        service-role client).
 * POST → create a webinar. Body { title: string, hook?, instructor_ids?:
 *        string[], scheduled_at?, duration_minutes?, registration_url?,
 *        creatives_url?, notes? }. New webinars start as drafts.
 *
 * Both routes are admin-allowlist gated and return `mode: 'unconfigured'`
 * when SUPABASE_SERVICE_ROLE_KEY isn't set — the same convention as Stories
 * and the Pipeline tab's entities/workers routes.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { insertWebinar, listRsvpCounts, listWebinars } from "@/lib/db/webinars";
import type { User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminUser(): Promise<{ user: User } | { error: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!isAdmin(user.email)) return { error: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET() {
  const gate = await requireAdminUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ webinars: [], rsvpCounts: {} });

  const admin = createAdminClient();
  const [webinars, rsvpCounts] = await Promise.all([listWebinars(admin), listRsvpCounts(admin)]);
  return NextResponse.json({ webinars, rsvpCounts });
}

export async function POST(req: Request) {
  const gate = await requireAdminUser();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    hook?: string | null;
    instructor_ids?: string[];
    scheduled_at?: string | null;
    duration_minutes?: number | null;
    registration_url?: string | null;
    creatives_url?: string | null;
    zoom_meeting_number?: string | null;
    zoom_passcode?: string | null;
    notes?: string | null;
  };

  const title = body.title?.trim();
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (
    body.instructor_ids !== undefined &&
    (!Array.isArray(body.instructor_ids) || body.instructor_ids.some((id) => typeof id !== "string"))
  ) {
    return NextResponse.json({ error: "instructor_ids must be an array of instructor ids" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, mode: "unconfigured" });
  }

  const webinar = await insertWebinar(createAdminClient(), {
    title,
    hook: body.hook?.trim() || null,
    instructor_ids: (body.instructor_ids ?? []).map((id) => id.trim()).filter(Boolean),
    scheduled_at: body.scheduled_at ?? null,
    duration_minutes: body.duration_minutes ?? null,
    registration_url: body.registration_url?.trim() || null,
    creatives_url: body.creatives_url?.trim() || null,
    zoom_meeting_number: body.zoom_meeting_number?.trim() || null,
    zoom_passcode: body.zoom_passcode?.trim() || null,
    notes: body.notes?.trim() || null,
  });
  return NextResponse.json({ ok: true, mode: "created", webinar });
}
