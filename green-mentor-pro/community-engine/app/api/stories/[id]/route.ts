/**
 * PUT    → update a story's title/content_type/status/target date/notes.
 * DELETE → remove a story permanently.
 *
 * Same admin-allowlist gate + service-role read/write as /api/stories.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { deleteStory, updateStory, type StoryContentType, type StoryStatus } from "@/lib/db/stories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES = ["webinar", "newsletter", "post", "social"] as const;
const STATUSES = ["draft", "review", "published", "archived"] as const;

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

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content_type?: string;
    status?: string;
    target_publish_date?: string | null;
    notes?: string | null;
    body_markdown?: string | null;
  };

  if (body.content_type && !CONTENT_TYPES.includes(body.content_type as StoryContentType)) {
    return NextResponse.json(
      { error: `content_type must be one of: ${CONTENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (body.status && !STATUSES.includes(body.status as StoryStatus)) {
    return NextResponse.json({ error: `status must be one of: ${STATUSES.join(", ")}` }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await updateStory(createAdminClient(), id, {
    ...(body.title !== undefined ? { title: body.title.trim() } : {}),
    ...(body.content_type !== undefined ? { content_type: body.content_type as StoryContentType } : {}),
    ...(body.status !== undefined ? { status: body.status as StoryStatus } : {}),
    ...(body.target_publish_date !== undefined ? { target_publish_date: body.target_publish_date } : {}),
    ...(body.notes !== undefined ? { notes: body.notes } : {}),
    ...(body.body_markdown !== undefined ? { body_markdown: body.body_markdown } : {}),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await deleteStory(createAdminClient(), id);
  return NextResponse.json({ ok: true });
}
