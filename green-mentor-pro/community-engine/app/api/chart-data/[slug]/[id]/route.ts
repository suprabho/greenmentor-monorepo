/**
 * Chart data for the scrollytelling preview. viz-engine's GenericChart
 * fetches the FIXED path /api/chart-data/<slug>/<id>; the preview passes the
 * story uuid as StoryShell's `slug`, so this route serves
 * community_story_charts rows keyed by (story uuid, chart id).
 *
 * Response shape is GenericChart's step contract:
 *   { steps: [{ title?, option }] }  — a bare ECharts option in `data` is
 * wrapped into a single step.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStoryChart } from "@/lib/db/storyCharts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ error: "unconfigured" }, { status: 503 });
  }

  const { slug, id } = await params;
  const row = await getStoryChart(createAdminClient(), slug, id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data = row.data as { steps?: unknown[] } | Record<string, unknown>;
  const steps =
    data && typeof data === "object" && Array.isArray((data as { steps?: unknown[] }).steps)
      ? (data as { steps: unknown[] }).steps
      : [{ option: data }];

  return NextResponse.json({ steps });
}
