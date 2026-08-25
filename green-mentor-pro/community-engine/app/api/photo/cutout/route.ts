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

import { readFile } from "node:fs/promises";
import path from "node:path";
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

  // App-relative paths (the bundled /avatars/… presets) are read straight
  // from the deployed public/ dir. Fetching them over HTTP bounced off auth
  // middleware / Vercel deployment protection and came back as an HTML login
  // page, which sharp then rejected with a cryptic "corrupt header … html
  // line 1" error.
  if (raw.startsWith("/")) {
    const publicDir = path.join(process.cwd(), "public");
    const abs = path.normalize(path.join(publicDir, raw.split("?")[0]));
    if (!abs.startsWith(publicDir + path.sep)) {
      return NextResponse.json({ error: "Invalid app-relative path." }, { status: 400 });
    }
    const bytes = await readFile(abs).catch(() => null);
    if (!bytes) {
      return NextResponse.json(
        { error: `No bundled file at ${raw} — upload the photo or paste a hosted URL.` },
        { status: 404 }
      );
    }
    return Buffer.from(bytes);
  }

  if (!/^https?:\/\//.test(raw)) {
    return NextResponse.json({ error: "url must be http(s) or app-relative." }, { status: 400 });
  }
  // Forward the caller's cookies for same-origin URLs so photos behind this
  // deployment's auth (or Vercel's deployment protection) resolve too.
  const sameOrigin = new URL(raw).origin === new URL(req.url).origin;
  const cookie = sameOrigin ? (req.headers.get("cookie") ?? "") : "";
  const res = await fetch(raw, cookie ? { headers: { cookie } } : undefined).catch(() => null);
  if (!res?.ok) {
    return NextResponse.json(
      { error: `Could not fetch the photo (${res ? `HTTP ${res.status}` : "network error"}).` },
      { status: 422 }
    );
  }
  const contentType = res.headers.get("content-type") ?? "";
  if (contentType && !contentType.startsWith("image/")) {
    return NextResponse.json(
      {
        error: `That URL returned ${contentType.split(";")[0]} instead of an image — it may be behind a login page. Upload the photo instead.`,
      },
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
