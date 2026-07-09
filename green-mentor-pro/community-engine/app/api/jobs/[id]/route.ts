/**
 * PUT    → update a job posting's fields (partial patch).
 * DELETE → remove a job posting.
 *
 * Same admin-allowlist gate + service-role writes as /api/jobs.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  deleteJob,
  updateJob,
  type JobEditableFields,
  type JobSeniority,
  type JobStatus,
} from "@/lib/db/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENIORITIES: JobSeniority[] = ["entry", "mid", "senior", "lead"];
const STATUSES: JobStatus[] = ["draft", "published", "archived"];

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
  if (body.seniority != null && body.seniority !== "" && !SENIORITIES.includes(body.seniority as JobSeniority)) {
    return NextResponse.json({ error: "invalid seniority" }, { status: 400 });
  }
  if (body.status !== undefined && !STATUSES.includes(body.status as JobStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const str = (v: unknown) => (v === null ? null : String(v).trim() || null);
  const patch: JobEditableFields = {
    ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
    ...(body.company !== undefined ? { company: str(body.company) } : {}),
    ...(body.location !== undefined ? { location: str(body.location) } : {}),
    ...(body.country !== undefined ? { country: str(body.country) } : {}),
    ...(body.employment_type !== undefined
      ? { employment_type: String(body.employment_type).trim() || "Full-time" }
      : {}),
    ...(body.experience !== undefined ? { experience: str(body.experience) } : {}),
    ...(body.seniority !== undefined
      ? { seniority: body.seniority ? (body.seniority as JobSeniority) : null }
      : {}),
    ...(body.details !== undefined ? { details: str(body.details) } : {}),
    ...(body.tags !== undefined
      ? { tags: (body.tags as string[]).map((t) => String(t).trim()).filter(Boolean) }
      : {}),
    ...(body.apply_url !== undefined ? { apply_url: str(body.apply_url) } : {}),
    ...(body.apply_email !== undefined ? { apply_email: str(body.apply_email) } : {}),
    ...(body.salary !== undefined ? { salary: str(body.salary) } : {}),
    ...(body.application_deadline !== undefined
      ? { application_deadline: str(body.application_deadline) }
      : {}),
    ...(body.preferred !== undefined ? { preferred: str(body.preferred) } : {}),
    ...(body.posted_on !== undefined ? { posted_on: str(body.posted_on) } : {}),
    ...(body.notes !== undefined ? { notes: str(body.notes) } : {}),
    ...(body.status !== undefined ? { status: body.status as JobStatus } : {}),
  };

  if (patch.title !== undefined && !patch.title) {
    return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await updateJob(createAdminClient(), id, patch);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await deleteJob(createAdminClient(), id);
  return NextResponse.json({ ok: true });
}
