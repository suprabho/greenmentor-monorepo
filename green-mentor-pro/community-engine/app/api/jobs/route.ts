/**
 * Jobs CMS — the ESG & sustainability jobs board.
 *
 * GET  → list every job (admin-only view; reads through the service-role client
 *        for consistency with the other admin sections).
 * POST → create a job. Body { title: string, company?, location?, country?,
 *        employment_type?, experience?, seniority?, details?, tags?: string[],
 *        apply_url?, apply_email?, salary?, application_deadline?, preferred?,
 *        posted_on?, notes?, status? }.
 *
 * Admin-allowlist gated; returns `mode: 'unconfigured'` when
 * SUPABASE_SERVICE_ROLE_KEY isn't set — same convention as Webinars/Instructors.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  insertJob,
  listJobs,
  type JobSeniority,
  type JobStatus,
} from "@/lib/db/jobs";
import type { User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SENIORITIES: JobSeniority[] = ["entry", "mid", "senior", "lead"];
const STATUSES: JobStatus[] = ["draft", "published", "archived"];

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
  if (!isServiceRoleConfigured()) return NextResponse.json({ jobs: [] });

  const jobs = await listJobs(createAdminClient());
  return NextResponse.json({ jobs });
}

export async function POST(req: Request) {
  const gate = await requireAdminUser();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }
  if (body.seniority != null && !SENIORITIES.includes(body.seniority as JobSeniority)) {
    return NextResponse.json({ error: "invalid seniority" }, { status: 400 });
  }
  if (body.status !== undefined && !STATUSES.includes(body.status as JobStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, mode: "unconfigured" });
  }

  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const job = await insertJob(createAdminClient(), {
    title,
    company: str(body.company),
    location: str(body.location),
    country: str(body.country),
    employment_type: str(body.employment_type) ?? "Full-time",
    experience: str(body.experience),
    seniority: (body.seniority as JobSeniority) ?? null,
    details: str(body.details),
    tags: ((body.tags as string[]) ?? []).map((t) => String(t).trim()).filter(Boolean),
    apply_url: str(body.apply_url),
    apply_email: str(body.apply_email),
    salary: str(body.salary),
    application_deadline: str(body.application_deadline),
    preferred: str(body.preferred),
    posted_on: str(body.posted_on),
    notes: str(body.notes),
    status: (body.status as JobStatus) ?? "draft",
  });
  return NextResponse.json({ ok: true, mode: "created", job });
}
