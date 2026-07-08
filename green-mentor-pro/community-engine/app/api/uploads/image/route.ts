/**
 * POST → upload an image (speaker/instructor headshot) and return its public
 * URL. Reuses the public `webinar-headers` bucket, grouping uploads by an
 * optional `folder` field (e.g. "speakers", "instructors"), and writes through
 * the service-role client (bypasses RLS) — same pattern as POST
 * /api/webinars/[id]/header.
 *
 * Body: multipart/form-data with `file` (image, ≤5 MB) and optional `folder`.
 * Admin gated. Returns { url } on success, or a helpful error when the service
 * role isn't configured (paste a hosted URL instead).
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER_BUCKET = "webinar-headers";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB — plenty for an avatar.
const ALLOWED_TYPE = /^image\/(png|jpe?g|webp|gif|avif)$/;

/** Keep the storage prefix to a safe slug so a `folder` value can't traverse. */
function safeFolder(raw: FormDataEntryValue | null): string {
  const slug = typeof raw === "string" ? raw.replace(/[^a-z0-9-]/gi, "").slice(0, 32) : "";
  return slug || "uploads";
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  if (!isServiceRoleConfigured()) {
    return NextResponse.json(
      {
        error:
          "Image hosting isn't configured — set SUPABASE_SERVICE_ROLE_KEY, or paste a hosted image URL instead.",
      },
      { status: 501 }
    );
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image file uploaded." }, { status: 400 });
  }
  if (!ALLOWED_TYPE.test(file.type)) {
    return NextResponse.json(
      { error: "Unsupported image type — use PNG, JPEG, WebP, GIF or AVIF." },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 5 MB." }, { status: 413 });
  }

  const folder = safeFolder(form?.get("folder") ?? null);
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${folder}/${user.id}-${Date.now()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const admin = createAdminClient();
  const { error: upErr } = await admin.storage
    .from(HEADER_BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (upErr) {
    const missing = /not found|does not exist|bucket/i.test(upErr.message);
    return NextResponse.json(
      {
        error: missing
          ? `Upload failed — the "${HEADER_BUCKET}" bucket is missing. Apply migration 0007.`
          : `Upload failed: ${upErr.message}`,
      },
      { status: 500 }
    );
  }

  const url = admin.storage.from(HEADER_BUCKET).getPublicUrl(path).data.publicUrl;
  return NextResponse.json({ url });
}
