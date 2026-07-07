/**
 * Stories — the community team's individual content pieces (webinars,
 * newsletters, posts, social), tracked from draft through publish.
 *
 * GET  → list every story (admin-only; `community_stories` has RLS enabled
 *        with no policies, so this reads through the service-role client).
 * POST → create a story. Body { title: string, content_type: 'webinar' |
 *        'newsletter' | 'post' | 'social', target_publish_date?: string,
 *        notes?: string }.
 *
 * Both routes are admin-allowlist gated and return `mode: 'unconfigured'`
 * when SUPABASE_SERVICE_ROLE_KEY isn't set — the same convention as the
 * Pipeline tab's entities/workers routes.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { insertStory, listStories, type StoryContentType } from "@/lib/db/stories";
import type { User } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES = ["webinar", "newsletter", "post", "social"] as const;

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
  if (!isServiceRoleConfigured()) return NextResponse.json([]);

  const stories = await listStories(createAdminClient());
  return NextResponse.json(stories);
}

export async function POST(req: Request) {
  const gate = await requireAdminUser();
  if ("error" in gate) return gate.error;

  const body = (await req.json().catch(() => ({}))) as {
    title?: string;
    content_type?: string;
    target_publish_date?: string | null;
    notes?: string | null;
  };

  const title = body.title?.trim();
  const contentType = body.content_type as StoryContentType | undefined;
  if (!title) return NextResponse.json({ error: "title is required" }, { status: 400 });
  if (!contentType || !CONTENT_TYPES.includes(contentType)) {
    return NextResponse.json(
      { error: `content_type must be one of: ${CONTENT_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, mode: "unconfigured" });
  }

  const story = await insertStory(createAdminClient(), {
    title,
    content_type: contentType,
    owner_id: gate.user.id,
    target_publish_date: body.target_publish_date ?? null,
    notes: body.notes?.trim() || null,
  });
  return NextResponse.json({ ok: true, mode: "created", story });
}
