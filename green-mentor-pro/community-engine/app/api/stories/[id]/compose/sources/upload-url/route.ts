/**
 * Signed upload URL for a source file too large to POST inline.
 *
 * POST { filename, size } → { path, token, bucket, maxBytes }
 *
 * Route-handler request bodies cap at ~4.5MB, so a 20MB regulatory PDF cannot
 * reach the sources route at all. The client instead:
 *   1. calls this route for a signed upload URL,
 *   2. PUTs the bytes straight to storage (no size ceiling in our request path),
 *   3. calls `POST …/sources` with `{ kind: 'upload', path }`, which downloads the
 *      object server-side, extracts its text, and deletes it.
 *
 * The signed token is the whole security boundary, so it is deliberately narrow: it
 * authorises a write to ONE path inside a PRIVATE bucket, and expires. The path is
 * derived server-side from the story id and a random suffix — never from client
 * input — so a caller cannot aim the upload at another story's prefix or traverse
 * out of the bucket.
 *
 * Deliberately does NOT import the ingest deps: this route only mints a token, so
 * it stays a small function. Extraction happens in the sources route.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getStory } from "@/lib/db/stories";
import {
  SOURCE_UPLOAD_BUCKET,
  SOURCE_UPLOAD_MAX_BYTES,
} from "@/lib/stories/source-upload";
import { isSupportedSourceFile, sourceExtension } from "@/lib/stories/source-extract";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id } = await params;

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      { error: "Large uploads need SUPABASE_SERVICE_ROLE_KEY set server-side." },
      { status: 503 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { filename?: string; size?: number };
  const filename = body.filename?.trim();
  if (!filename) return NextResponse.json({ error: "filename is required" }, { status: 400 });
  if (!isSupportedSourceFile(filename)) {
    return NextResponse.json(
      { error: `Unsupported file type '${sourceExtension(filename) || filename}'.` },
      { status: 400 }
    );
  }
  if (typeof body.size === "number" && body.size > SOURCE_UPLOAD_MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File is ${(body.size / 1024 / 1024).toFixed(1)}MB — the limit is ${
          SOURCE_UPLOAD_MAX_BYTES / 1024 / 1024
        }MB.`,
      },
      { status: 413 }
    );
  }

  const client = createAdminClient();
  // Confirm the story exists before minting a token for its prefix — otherwise a
  // typo'd id silently accumulates orphaned objects nothing will ever clean up.
  const story = await getStory(client, id);
  if (!story) return NextResponse.json({ error: "story not found" }, { status: 404 });

  // Path is server-derived: `<storyId>/<uuid><ext>`. The original filename is NOT
  // used as the object name (it would let a caller inject a path) — it travels
  // separately in the sources call and becomes the row's title.
  const path = `${id}/${randomUUID()}${sourceExtension(filename)}`;
  const { data, error } = await client.storage
    .from(SOURCE_UPLOAD_BUCKET)
    .createSignedUploadUrl(path);
  if (error || !data) {
    return NextResponse.json(
      {
        error:
          `Could not create an upload URL: ${error?.message ?? "unknown error"}. ` +
          `If the bucket is missing, apply migration 0022_story_source_uploads_bucket.sql.`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    bucket: SOURCE_UPLOAD_BUCKET,
    path: data.path,
    token: data.token,
    maxBytes: SOURCE_UPLOAD_MAX_BYTES,
  });
}
