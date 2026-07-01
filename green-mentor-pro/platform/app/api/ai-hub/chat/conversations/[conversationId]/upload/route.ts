import { NextResponse } from "next/server";
import { createAdminClient } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";
import { assertOwner } from "@/lib/chat/repo";

export const runtime = "nodejs";
export const maxDuration = 30;

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf"]);
const MAX_IMAGE = 10 * 1024 * 1024; // 10 MB
const MAX_PDF = 20 * 1024 * 1024; // 20 MB (well under Anthropic's ~32 MB cap)
const SIGNED_URL_TTL = 60 * 60 * 24 * 7; // 7 days

/**
 * POST — upload a composer attachment to the private `chat-uploads` bucket and
 * return a signed URL for a FileUIPart. Anthropic accepts images + PDFs only.
 */
export async function POST(req: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  const { conversationId } = await params;
  if (!(await assertOwner(ctx.orgId, ctx.userId, conversationId))) {
    return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"}` }, { status: 400 });
  }
  const max = file.type === "application/pdf" ? MAX_PDF : MAX_IMAGE;
  if (file.size > max) {
    return NextResponse.json({ error: `File too large (max ${Math.round(max / 1024 / 1024)} MB)` }, { status: 400 });
  }

  const admin = createAdminClient();
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${ctx.orgId}/${conversationId}/${crypto.randomUUID()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: upErr } = await admin.storage.from("chat-uploads").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  const { data: signed, error: signErr } = await admin.storage
    .from("chat-uploads")
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message ?? "could not sign url" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, mediaType: file.type, filename: file.name });
}
