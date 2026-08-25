/**
 * POST → remove the background from a speaker photo. Returns image/png with a
 * transparent background (subject kept, source resolution).
 *
 * Body: multipart/form-data with `file` (image, ≤5 MB), OR JSON { url } — an
 * absolute http(s) URL or an app-relative path (e.g. "/avatars/rao.jpg"),
 * fetched server-side so the browser never hits cross-origin image CORS.
 *
 * Admin gated like /api/uploads/image. The studio calls this, then pushes the
 * returned PNG through the normal upload flow, so the cutout becomes a plain
 * hosted photo URL and every render surface stays unchanged.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { cutoutImage } from "@/lib/photo/cutout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Model init + inference is CPU-bound; comfortably under a minute, but give
// cold starts headroom.
export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPE = /^image\/(png|jpe?g|webp|gif|avif)$/;

async function readSource(req: Request): Promise<Buffer | NextResponse> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
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
    return Buffer.from(await file.arrayBuffer());
  }

  const body = await req.json().catch(() => null);
  const raw = typeof body?.url === "string" ? body.url.trim() : "";
  if (!raw) {
    return NextResponse.json(
      { error: "Send an image file or { url }." },
      { status: 400 }
    );
  }
  // App-relative paths (bundled avatars) resolve against this deployment.
  const url = raw.startsWith("/") ? new URL(raw, new URL(req.url).origin).href : raw;
  if (!/^https?:\/\//.test(url)) {
    return NextResponse.json({ error: "url must be http(s) or app-relative." }, { status: 400 });
  }
  const res = await fetch(url).catch(() => null);
  if (!res?.ok) {
    return NextResponse.json(
      { error: `Could not fetch the photo (${res ? `HTTP ${res.status}` : "network error"}).` },
      { status: 422 }
    );
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Image is larger than 5 MB." }, { status: 413 });
  }
  return bytes;
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const source = await readSource(req);
  if (source instanceof NextResponse) return source;

  try {
    const png = await cutoutImage(source);
    return new Response(new Uint8Array(png), {
      status: 200,
      headers: { "Content-Type": "image/png", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Background removal failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }
}
