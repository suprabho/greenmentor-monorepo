import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEngagement, updateEngagement } from "@/lib/db/engagements";
import { getOrCreateUploadRequest, insertSubmission } from "@/lib/db/dataCollection";
import { efdbBase, efdbParseDocument } from "@/lib/efdb/client";

export const runtime = "nodejs";

type ParseStatus = "parsed" | "unsupported" | "error" | "skipped";

/**
 * Upload an evidence document for an engagement. Stores it in the esg-evidence
 * Supabase Storage bucket (scoped by org/engagement), records an esg_data_submissions
 * row, and appends it to engagement.config.documents so the data-collection phase can
 * use it.
 */
export async function POST(req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const engagement = await getEngagement(session.orgUuid, engagementId);
  if (!engagement) return NextResponse.json({ error: "Engagement not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const bucket = process.env.ESG_STORAGE_BUCKET || "esg-evidence";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${session.orgUuid}/${engagementId}/${Date.now()}_${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const admin = createAdminClient();
  const up = await admin.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (up.error) return NextResponse.json({ error: `storage: ${up.error.message}` }, { status: 500 });

  const requestId = await getOrCreateUploadRequest(session.orgUuid, engagementId);
  await insertSubmission(session.orgUuid, {
    dataRequestId: requestId,
    storagePath: path,
    channel: "bulk_upload",
    submittedBy: session.userUuid,
  });

  // Parse the document to markdown via EFDB's shared liteparse/markitdown layer
  // (eager: the data-collection agent reads this markdown in "My data" mode, and
  // keeping it on the doc record lets assembleInput stay synchronous). EFDB
  // unconfigured → "skipped"; an unsupported file type → "unsupported".
  let parseStatus: ParseStatus = "skipped";
  let parsed: Awaited<ReturnType<typeof efdbParseDocument>> = null;
  let parseError: string | undefined;
  if (efdbBase()) {
    try {
      parsed = await efdbParseDocument(bytes, file.name, file.type || "application/octet-stream");
      parseStatus = parsed ? "parsed" : "error";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "parse failed";
      parseStatus = /unsupported|spreadsheet/i.test(msg) ? "unsupported" : "error";
      parseError = msg;
    }
  }

  const documents = [
    ...((engagement.config?.documents as unknown[]) ?? []),
    {
      name: file.name, path, content_type: file.type, size: file.size,
      parse_status: parseStatus,
      ...(parsed
        ? { markdown: parsed.markdown, page_count: parsed.page_count, parser: parsed.parser, used_ocr: parsed.used_ocr }
        : {}),
      ...(parseError ? { parse_error: parseError } : {}),
    },
  ];
  await updateEngagement(session.orgUuid, engagementId, { configPatch: { documents } });

  return NextResponse.json({
    ok: true, path, metric: file.name,
    parse_status: parseStatus, page_count: parsed?.page_count ?? null, parse_error: parseError ?? null,
  });
}
