/**
 * PUT    → update an instructor's profile fields.
 * DELETE → remove an instructor. Note: community_webinars.instructor_ids is a
 *          plain uuid[] (not an FK array), so deleting leaves a dangling id on
 *          any webinar that referenced them — it simply resolves to nothing on
 *          the cards. Re-pick in the webinar editor if needed.
 *
 * Same admin-allowlist gate + service-role writes as /api/instructors.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { deleteInstructor, updateInstructor, type InstructorEditableFields } from "@/lib/db/instructors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminGate(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }

  const str = (v: unknown) => (v === null ? null : String(v).trim() || null);
  const patch: InstructorEditableFields = {
    ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
    ...(body.role !== undefined ? { role: str(body.role) } : {}),
    ...(body.company !== undefined ? { company: str(body.company) } : {}),
    ...(body.location !== undefined ? { location: str(body.location) } : {}),
    ...(body.education !== undefined ? { education: str(body.education) } : {}),
    ...(body.initials !== undefined ? { initials: String(body.initials).trim() } : {}),
    ...(body.photo !== undefined ? { photo: str(body.photo) } : {}),
    ...(body.tags !== undefined
      ? { tags: (body.tags as string[]).map((t) => String(t).trim()).filter(Boolean) }
      : {}),
    ...(body.linkedin_url !== undefined ? { linkedin_url: str(body.linkedin_url) } : {}),
  };

  if (patch.name !== undefined && !patch.name) {
    return NextResponse.json({ error: "name cannot be empty" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await updateInstructor(createAdminClient(), id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await deleteInstructor(createAdminClient(), id);
  return NextResponse.json({ ok: true });
}
