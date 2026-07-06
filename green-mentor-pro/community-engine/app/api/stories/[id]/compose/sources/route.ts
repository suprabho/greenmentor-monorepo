/**
 * Sources — the link/pasted-text material an admin grounds a story's
 * AI-assisted draft in. Link sources are fetched server-side (SSRF-guarded
 * via lib/security/urlGuard) and reduced to plaintext; pasted text is stored
 * as-is. No file/PDF/Office upload and no async extraction worker — a fetch
 * or parse failure still inserts a visible `status: "failed"` row rather than
 * erroring the request, so the admin can see and retry it.
 *
 * Same admin-allowlist gate + service-role read/write as /api/stories.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listStorySources, insertStorySource } from "@/lib/db/story-sources";
import { fetchGuarded } from "@/lib/security/urlGuard";
import { htmlToPlainText } from "@/lib/stories/compose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json([]);

  const { id } = await params;
  const sources = await listStorySources(createAdminClient(), id);
  return NextResponse.json(sources);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    url?: string;
    title?: string;
    text?: string;
  };

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });
  const client = createAdminClient();

  if (body.kind === "link") {
    const url = body.url?.trim();
    if (!url) return NextResponse.json({ error: "url is required" }, { status: 400 });

    const result = await fetchGuarded(url, { accept: "text/html" });
    if (!result.ok) {
      const source = await insertStorySource(client, {
        story_id: id,
        kind: "link",
        title: body.title?.trim() || url,
        url,
        status: "failed",
        error: result.message,
      });
      return NextResponse.json({ ok: true, source });
    }

    const upstream = result.response;
    const contentType = upstream.headers.get("content-type") ?? "";
    if (!upstream.ok || !contentType.startsWith("text/html")) {
      const source = await insertStorySource(client, {
        story_id: id,
        kind: "link",
        title: body.title?.trim() || url,
        url,
        status: "failed",
        error: !upstream.ok ? `Upstream ${upstream.status}` : "Not an HTML page",
      });
      return NextResponse.json({ ok: true, source });
    }

    const html = await upstream.text();
    const extracted = htmlToPlainText(html);
    const source = await insertStorySource(client, {
      story_id: id,
      kind: "link",
      title: body.title?.trim() || url,
      url,
      extracted_text: extracted,
      status: extracted ? "extracted" : "failed",
      error: extracted ? null : "No text content found",
    });
    return NextResponse.json({ ok: true, source });
  }

  if (body.kind === "text") {
    const text = body.text?.trim();
    if (!text) return NextResponse.json({ error: "text is required" }, { status: 400 });
    const source = await insertStorySource(client, {
      story_id: id,
      kind: "text",
      title: body.title?.trim() || "Pasted text",
      extracted_text: text,
      status: "extracted",
    });
    return NextResponse.json({ ok: true, source });
  }

  return NextResponse.json({ error: "kind must be 'link' or 'text'" }, { status: 400 });
}
