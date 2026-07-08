/**
 * PUT    → update a webinar's scheduling fields, status, or funnel metrics.
 * DELETE → remove a webinar permanently (cascades to its RSVPs).
 *
 * Same admin-allowlist gate + service-role read/write as /api/webinars.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  deleteWebinar,
  getWebinar,
  updateWebinar,
  WEBINAR_METRIC_FIELDS,
  type WebinarEditableFields,
  type WebinarStatus,
} from "@/lib/db/webinars";
import { listInstructorsByIds, type InstructorLite } from "@/lib/db/instructors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUSES = ["draft", "published", "completed", "archived"] as const;

async function requireAdminGate(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

/**
 * GET → a single webinar plus its resolved instructors (in instructor_ids order),
 * so the Header Studio can prefill the speaker card with name/role/company/photo.
 * Admin-only.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ webinar: null, mode: "unconfigured" });

  const admin = createAdminClient();
  const webinar = await getWebinar(admin, id);
  if (!webinar) return NextResponse.json({ error: "not found" }, { status: 404 });

  const byId = await listInstructorsByIds(admin, webinar.instructor_ids);
  const instructors = webinar.instructor_ids
    .map((iid) => byId[iid])
    .filter((x): x is InstructorLite => Boolean(x));
  return NextResponse.json({ webinar, instructors });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  if (body.status !== undefined && !STATUSES.includes(body.status as WebinarStatus)) {
    return NextResponse.json({ error: `status must be one of: ${STATUSES.join(", ")}` }, { status: 400 });
  }
  if (
    body.instructor_ids !== undefined &&
    (!Array.isArray(body.instructor_ids) || (body.instructor_ids as unknown[]).some((v) => typeof v !== "string"))
  ) {
    return NextResponse.json({ error: "instructor_ids must be an array of instructor ids" }, { status: 400 });
  }
  for (const field of WEBINAR_METRIC_FIELDS) {
    const value = body[field];
    if (value === undefined || value === null) continue;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
      return NextResponse.json({ error: `${field} must be a non-negative integer` }, { status: 400 });
    }
  }

  const patch: WebinarEditableFields = {
    ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
    ...(body.hook !== undefined ? { hook: body.hook === null ? null : String(body.hook).trim() || null } : {}),
    ...(body.instructor_ids !== undefined
      ? { instructor_ids: (body.instructor_ids as string[]).map((v) => String(v).trim()).filter(Boolean) }
      : {}),
    ...(body.scheduled_at !== undefined ? { scheduled_at: body.scheduled_at as string | null } : {}),
    ...(body.duration_minutes !== undefined
      ? { duration_minutes: body.duration_minutes as number | null }
      : {}),
    ...(body.registration_url !== undefined
      ? { registration_url: (body.registration_url as string | null)?.trim() || null }
      : {}),
    ...(body.creatives_url !== undefined
      ? { creatives_url: (body.creatives_url as string | null)?.trim() || null }
      : {}),
    ...(body.cover_image_url !== undefined
      ? { cover_image_url: (body.cover_image_url as string | null)?.trim() || null }
      : {}),
    ...(body.status !== undefined ? { status: body.status as WebinarStatus } : {}),
    ...(body.notes !== undefined ? { notes: body.notes as string | null } : {}),
  };
  for (const field of WEBINAR_METRIC_FIELDS) {
    if (body[field] !== undefined) patch[field] = body[field] as number | null;
  }

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await updateWebinar(createAdminClient(), id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await deleteWebinar(createAdminClient(), id);
  return NextResponse.json({ ok: true });
}
