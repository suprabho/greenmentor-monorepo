/**
 * Instructors CMS — the roster of practitioners selectable on webinars.
 *
 * GET  → list every instructor (admin-only view; reads through the service-role
 *        client for consistency with the other admin sections).
 * POST → create an instructor. Body { name: string, role?, company?, location?,
 *        education?, initials?, photo?, tags?: string[], linkedin_url? }.
 *
 * Admin-allowlist gated; returns `mode: 'unconfigured'` when
 * SUPABASE_SERVICE_ROLE_KEY isn't set — same convention as Webinars/Stories.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { deriveInitials, insertInstructor, listInstructors } from "@/lib/db/instructors";
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
  if (!isServiceRoleConfigured()) return NextResponse.json({ instructors: [] });

  const instructors = await listInstructors(createAdminClient());
  return NextResponse.json({ instructors });
}

export async function POST(req: Request) {
  const gate = await requireAdminUser();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    role?: string | null;
    company?: string | null;
    location?: string | null;
    education?: string | null;
    initials?: string | null;
    photo?: string | null;
    tags?: string[];
    linkedin_url?: string | null;
  };

  const name = body.name?.trim();
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (body.tags !== undefined && !Array.isArray(body.tags)) {
    return NextResponse.json({ error: "tags must be an array of strings" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, mode: "unconfigured" });
  }

  const instructor = await insertInstructor(createAdminClient(), {
    name,
    role: body.role?.trim() || null,
    company: body.company?.trim() || null,
    location: body.location?.trim() || null,
    education: body.education?.trim() || null,
    initials: body.initials?.trim() || deriveInitials(name),
    photo: body.photo?.trim() || null,
    tags: (body.tags ?? []).map((t) => t.trim()).filter(Boolean),
    linkedin_url: body.linkedin_url?.trim() || null,
  });
  return NextResponse.json({ ok: true, mode: "created", instructor });
}
