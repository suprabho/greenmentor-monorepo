// POST — upload a bill/evidence file to the private `energy-uploads` bucket and
// return its storage path (stored on the entry's evidence_paths) plus a signed
// URL for immediate preview/download. Mirrors the ai-hub chat upload route.
import { NextResponse } from "next/server";
import { createAdminClient } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/webp", "application/pdf",
  "application/zip", "application/x-zip-compressed",
]);
const MAX_BYTES = 20 * 1024 * 1024; // 20 MB
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: Request) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 });
    }

    const admin = createAdminClient();
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${ctx.orgId}/${crypto.randomUUID()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    const { error: upErr } = await admin.storage
      .from("energy-uploads")
      .upload(path, bytes, { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { data: signed } = await admin.storage
      .from("energy-uploads")
      .createSignedUrl(path, SIGNED_URL_TTL);

    return NextResponse.json({ path, url: signed?.signedUrl ?? null, filename: file.name });
  } catch (e) {
    return jsonError(e);
  }
}
