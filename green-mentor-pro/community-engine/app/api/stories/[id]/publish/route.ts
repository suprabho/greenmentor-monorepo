/**
 * POST → publish this vismay-format story to the learner platform: dry-run
 * the full reader path over the SAVED draft (parse → config validate →
 * anchor integrity → resolveUnits — fail fast with an actionable message),
 * snapshot the document pair + charts, and upsert the story's row in
 * community_story_publications — which the platform's /stories reader loads
 * through the stories_public view and re-renders live. Republishing replaces
 * the snapshot in place; the slug fills only when blank so renames never
 * 404 a shared link.
 *
 * DELETE → unpublish: remove the publication row (the platform 404s).
 * `story-assets` bucket files are left alone — drafts still reference them.
 *
 * Admin-allowlist gated + service-role writes, like the share-cards publish
 * route (0019's pattern).
 */

import { NextResponse } from "next/server";
import { parseStoryContent } from "@vismay/content-source/content";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory } from "@/lib/db/stories";
import { listStoryCharts } from "@/lib/db/storyCharts";
import {
  deleteStoryPublication,
  upsertStoryPublication,
} from "@/lib/db/storyPublications";
import { validateGmStoryDocument } from "@/lib/stories/validateDocument";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdminGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { denied: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!isAdmin(user.email)) {
    return { denied: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { user };
}

function serviceRoleMissing(): NextResponse {
  return NextResponse.json(
    { error: "Publishing isn't configured — set SUPABASE_SERVICE_ROLE_KEY (the worker write key)." },
    { status: 503 }
  );
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminGate();
  if ("denied" in gate) return gate.denied;
  if (!isServiceRoleConfigured()) return serviceRoleMissing();
  const { id } = await params;

  const admin = createAdminClient();
  const story = await getStory(admin, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });
  if (story.body_format !== "vismay" || !story.body_markdown || !story.config_json) {
    return NextResponse.json(
      { error: "Only web stories (body_format = 'vismay') with a document + config can be published." },
      { status: 400 }
    );
  }

  // Publish gate: the snapshot must render. Reject with the parser's own
  // message rather than letting the public route 500 later.
  const validation = validateGmStoryDocument(id, story.body_markdown, story.config_json);
  if (!validation.ok) {
    return NextResponse.json(
      { error: `Story doesn't render: ${validation.error}` },
      { status: 400 }
    );
  }

  const fm = parseStoryContent(story.body_markdown).frontmatter as {
    title?: string;
    subtitle?: string;
    byline?: string;
    format?: string;
  };

  const chartRows = await listStoryCharts(admin, id);
  const charts: Record<string, unknown> = {};
  for (const row of chartRows) charts[row.chart_id] = row.data;

  const publication = await upsertStoryPublication(admin, {
    story_id: id,
    title: fm.title?.trim() || story.title,
    subtitle: fm.subtitle?.trim() || null,
    byline: fm.byline?.trim() || null,
    format: fm.format === "map" ? "map" : "deck",
    markdown: story.body_markdown,
    config_json: story.config_json,
    charts,
    published_by: gate.user.id,
  });

  return NextResponse.json({
    ok: true,
    publication: {
      id: publication.id,
      slug: publication.slug,
      id_prefix: publication.id_prefix,
      published_at: publication.published_at,
    },
    ...(validation.warnings.length ? { warnings: validation.warnings } : {}),
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminGate();
  if ("denied" in gate) return gate.denied;
  if (!isServiceRoleConfigured()) return serviceRoleMissing();
  const { id } = await params;

  await deleteStoryPublication(createAdminClient(), id);
  return NextResponse.json({ ok: true });
}
