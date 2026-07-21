/**
 * A single webinar poll — PUT updates the question / status / options, DELETE
 * removes it (options cascade). Both are scoped by (webinarId, pollId) in the
 * db helpers because the service-role client bypasses RLS.
 *
 * Same admin-allowlist gate + service-role write as the collection route.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { deletePoll, replaceOptions, updatePoll } from "@/lib/db/webinar-polls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id, pollId } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    question?: string;
    options?: unknown;
    status?: string;
    position?: number;
  };

  if (body.question !== undefined && !body.question.trim()) {
    return NextResponse.json({ error: "question cannot be empty" }, { status: 400 });
  }
  if (body.options !== undefined && !Array.isArray(body.options)) {
    return NextResponse.json({ error: "options must be an array of strings" }, { status: 400 });
  }
  if (body.status !== undefined && !["draft", "published", "closed"].includes(body.status)) {
    return NextResponse.json({ error: "status must be draft, published or closed" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  const patch = {
    ...(body.question !== undefined ? { question: body.question.trim() } : {}),
    ...(body.status !== undefined ? { status: body.status as "draft" | "published" | "closed" } : {}),
    ...(typeof body.position === "number" ? { position: body.position } : {}),
  };
  if (Object.keys(patch).length > 0) await updatePoll(client, id, pollId, patch);
  if (body.options !== undefined) {
    await replaceOptions(client, pollId, (body.options as unknown[]).map((o) => String(o)));
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; pollId: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id, pollId } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await deletePoll(createAdminClient(), id, pollId);
  return NextResponse.json({ ok: true });
}
