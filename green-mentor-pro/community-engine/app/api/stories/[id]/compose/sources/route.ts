/**
 * Sources — the material an admin grounds a story's AI-assisted draft in.
 *
 * Four kinds: a link (fetched server-side, SSRF-guarded, then run through the
 * pipeline's readability extractor), pasted text (stored as-is), a pipeline
 * article (pulled from the Pipeline tab's already-ingested + AI-summarized
 * `articles` table — no live fetch), and an uploaded file. A fetch or parse
 * failure still inserts a visible `status: "failed"` row rather than erroring
 * the request, so the admin can see and retry it.
 *
 * A file arrives one of two ways, and the difference is purely transport:
 *   - up to 4MB: multipart on this route, dispatched by content type;
 *   - larger: the client gets a signed URL from `…/sources/upload-url`, PUTs the
 *     bytes straight to a private bucket, then calls here with
 *     `{ kind: 'upload', path }`. Route-handler bodies cap at ~4.5MB, so a 20MB
 *     report cannot reach this route in one request at all.
 * Both extract through the same `extractSourceFile`.
 *
 * THIS IS THE ONLY ROUTE THAT TOUCHES THE HEAVY INGEST DEPS (pdf-parse, pdfjs,
 * LiteParse's native binding, jsdom, and markitdown's subprocess). They are
 * declared in `serverExternalPackages` and LiteParse's binaries are force-traced
 * for THIS path only — see next.config.ts.
 *
 * Extraction never uses a model. A source document is the one input here that
 * must not be invented, so a scan neither reader can open is reported as thin
 * rather than transcribed by a vision model.
 *
 * Same admin-allowlist gate + service-role read/write as /api/stories.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { listStorySources, insertStorySource } from "@/lib/db/story-sources";
import { fetchGuarded } from "@/lib/security/urlGuard";
import { htmlToPlainText } from "@/lib/stories/compose";
import { fetchShareCardArticles } from "@/lib/share-cards/articles";
import {
  SUPPORTED_SOURCE_EXTS,
  extractHtmlBody,
  extractSourceFile,
} from "@/lib/stories/source-extract";
import {
  INLINE_UPLOAD_MAX_BYTES,
  SOURCE_UPLOAD_BUCKET,
  isOwnUploadPath,
  isSupportedSourceFile,
  sourceExtension,
} from "@/lib/stories/source-upload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Extraction is the slow part: a scanned PDF walks every page through LiteParse,
// and an Office file shells out to markitdown.
export const maxDuration = 60;

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

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  // A file arrives as multipart, everything else as JSON. Dispatching on the
  // content type keeps creation on one verb rather than putting uploads on PUT,
  // which would read as "replace the source list".
  if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
    return postInlineFile(req, id);
  }

  const body = (await req.json().catch(() => ({}))) as {
    kind?: string;
    url?: string;
    title?: string;
    text?: string;
    articleId?: string;
    /** kind: 'upload' — the storage path the client PUT the file to. */
    path?: string;
  };

  const client = createAdminClient();

  if (body.kind === "pipeline") {
    const articleId = body.articleId?.trim();
    if (!articleId) return NextResponse.json({ error: "articleId is required" }, { status: 400 });

    const [article] = await fetchShareCardArticles(client, { ids: [articleId] });
    if (!article) return NextResponse.json({ error: "article not found" }, { status: 404 });

    const source = await insertStorySource(client, {
      story_id: id,
      kind: "pipeline",
      title: article.title,
      url: article.url,
      extracted_text: article.summary,
      status: article.summary ? "extracted" : "failed",
      error: article.summary ? null : "Article has no summary yet",
    });
    return NextResponse.json({ ok: true, source });
  }

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
    const extracted = await extractHtmlBody(html, htmlToPlainText);
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

  if (body.kind === "upload") {
    return postUploadedPath(id, body);
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

  return NextResponse.json(
    {
      error:
        "kind must be 'link', 'text', 'pipeline', or 'upload' — or send multipart/form-data for an inline file",
    },
    { status: 400 }
  );
}

/** Inline multipart upload, for files small enough to fit a request body. */
async function postInlineFile(req: Request, id: string) {
  const client = createAdminClient();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "expected multipart/form-data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "a 'file' part is required" }, { status: 400 });
  }
  if (file.size === 0) return NextResponse.json({ error: "file is empty" }, { status: 400 });
  if (file.size > INLINE_UPLOAD_MAX_BYTES) {
    // The client is expected to have taken the signed-URL path already; this is
    // the backstop for one that didn't.
    return NextResponse.json(
      {
        error: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — larger than the ${
          INLINE_UPLOAD_MAX_BYTES / 1024 / 1024
        }MB inline limit. Request a signed upload URL instead.`,
      },
      { status: 413 }
    );
  }
  if (!isSupportedSourceFile(file.name)) {
    return NextResponse.json(
      {
        error: `Unsupported file type '${sourceExtension(file.name) || file.name}'. Supported: ${SUPPORTED_SOURCE_EXTS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const title = (form.get("title") as string | null)?.trim() || file.name;
  return insertExtracted(client, id, title, Buffer.from(await file.arrayBuffer()), file.name);
}

/**
 * The signed-URL path's second half: read the object the client uploaded straight
 * to storage, extract it, and delete it.
 *
 * The bucket is staging, not a library — leaving objects behind would accumulate
 * unpublished third-party material indefinitely. Deletion is best-effort: the
 * source row is the deliverable, so a failed cleanup must not fail the request.
 */
async function postUploadedPath(id: string, body: { path?: string; title?: string }) {
  const client = createAdminClient();
  const path = body.path?.trim() ?? "";
  // The service-role client bypasses RLS, so an unchecked path would let a caller
  // name any object in the bucket — including another story's upload.
  if (!isOwnUploadPath(path, id)) {
    return NextResponse.json({ error: "path is not an upload for this story" }, { status: 400 });
  }
  if (!isSupportedSourceFile(path)) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }

  const { data, error } = await client.storage.from(SOURCE_UPLOAD_BUCKET).download(path);
  if (error || !data) {
    return NextResponse.json(
      { error: `Could not read the uploaded file: ${error?.message ?? "not found"}` },
      { status: 404 }
    );
  }
  const buf = Buffer.from(await data.arrayBuffer());
  const title = body.title?.trim() || path.split("/").pop() || "Uploaded file";

  try {
    return await insertExtracted(client, id, title, buf, path);
  } finally {
    await client.storage
      .from(SOURCE_UPLOAD_BUCKET)
      .remove([path])
      .catch(() => undefined);
  }
}

/**
 * Extract a file's text and record it as a source row.
 *
 * A failed extraction still inserts a `status: 'failed'` row — the row IS the
 * record of the failure, and an author needs to see which file didn't read rather
 * than have it vanish.
 */
async function insertExtracted(
  client: ReturnType<typeof createAdminClient>,
  storyId: string,
  title: string,
  buf: Buffer,
  filename: string
) {
  let text = "";
  let warning: string | null = null;
  let failure: string | null = null;
  try {
    const out = await extractSourceFile(buf, filename);
    text = out.text;
    warning = out.warning;
  } catch (e) {
    failure = e instanceof Error ? e.message : String(e);
  }

  const source = await insertStorySource(client, {
    story_id: storyId,
    // `story_sources.kind` has no 'file' value (migration 0013 allows link | text
    // | pipeline), and an extracted file IS pasted text as far as generation is
    // concerned — the filename lives in `title`. Avoids a migration for a
    // distinction nothing downstream reads.
    kind: "text",
    title,
    extracted_text: text || null,
    status: text ? "extracted" : "failed",
    error: text ? warning : (failure ?? "No text could be extracted"),
  });
  return NextResponse.json({ ok: true, source, ...(warning ? { warning } : {}) });
}
