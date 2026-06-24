import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEngagement, updateEngagement } from "@/lib/db/engagements";
import { getOrCreateUploadRequest, insertSubmission } from "@/lib/db/dataCollection";

export const runtime = "nodejs";

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

  const documents = [
    ...((engagement.config?.documents as unknown[]) ?? []),
    { name: file.name, path, content_type: file.type, size: file.size },
  ];
  await updateEngagement(session.orgUuid, engagementId, { configPatch: { documents } });

  return NextResponse.json({ ok: true, path, metric: file.name });
}
