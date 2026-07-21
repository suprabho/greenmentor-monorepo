/**
 * Polls attached to a webinar — GET lists them (with options), POST creates
 * one. Static polls the learner platform renders on the live page; answers are
 * recorded platform-side in webinar_poll_responses.
 *
 * Same admin-allowlist gate + service-role read/write as /api/webinars, and
 * the same `mode: 'unconfigured'` shortcut when SUPABASE_SERVICE_ROLE_KEY
 * isn't set.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { insertPoll, listPolls, replaceOptions } from "@/lib/db/webinar-polls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ polls: [] });

  const { id } = await params;
  const polls = await listPolls(createAdminClient(), id);
  return NextResponse.json({ polls });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    question?: string;
    options?: unknown;
    status?: string;
    position?: number;
  };

  const question = body.question?.trim();
  if (!question) return NextResponse.json({ error: "question is required" }, { status: 400 });
  if (body.options !== undefined && !Array.isArray(body.options)) {
    return NextResponse.json({ error: "options must be an array of strings" }, { status: 400 });
  }
  if (body.status !== undefined && !["draft", "published", "closed"].includes(body.status)) {
    return NextResponse.json({ error: "status must be draft, published or closed" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const poll = await insertPoll(client, {
    webinar_id: id,
    question,
    status: body.status as "draft" | "published" | "closed" | undefined,
    position: typeof body.position === "number" ? body.position : undefined,
  });
  const labels = ((body.options as unknown[]) ?? []).map((o) => String(o));
  const options = await replaceOptions(client, poll.id, labels);
  return NextResponse.json({ ok: true, poll: { ...poll, options } });
}
