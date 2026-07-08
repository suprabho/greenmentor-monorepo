/**
 * POST → render an Aura header for this webinar, upload it to the public
 * `webinar-headers` bucket, and link it back onto the webinar:
 *   - cover_image_url → the hosted PNG (shown on the learner webinar cards)
 *   - creatives_url   → a /header-studio?load=<id> deep-link (admin re-open)
 *
 * Body { config: HeaderConfig, creativesUrl?: string }. Admin-allowlist gated;
 * renders through the same pipeline as /api/header/export (warm Fly service when
 * HEADER_RENDER_URL is set, in-process Playwright otherwise) and writes through
 * the service-role client. Returns `mode: 'unconfigured'` when the service-role
 * key isn't set — matching the other webinar routes.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { updateWebinar } from "@/lib/db/webinars";
import { DEFAULT_CONFIG, type HeaderConfig } from "@/lib/header/types";
import { renderHeader } from "@/lib/header/screenshot";
import { renderHeaderViaService, renderServiceConfigured } from "@/lib/header/remote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Rendering drives a browser (or proxies the Fly service) — same budget as the
// header export route.
export const maxDuration = 300;

const HEADER_BUCKET = "webinar-headers";

async function requireAdminGate(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdminGate();
  if (denied) return denied;
  const { id } = await params;

  const body = (await req.json().catch(() => ({}))) as {
    config?: Partial<HeaderConfig>;
    creativesUrl?: string;
  };
  const config: HeaderConfig = { ...DEFAULT_CONFIG, ...(body.config ?? {}) };
  if (!config.title?.trim()) {
    return NextResponse.json({ error: "config.title is required" }, { status: 400 });
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, mode: "unconfigured" });
  }

  // Render the PNG through the shared header pipeline.
  let bytes: Buffer;
  try {
    const origin = new URL(req.url).origin;
    bytes = renderServiceConfigured()
      ? await renderHeaderViaService(config, { origin, scale: 2, format: "png" })
      : await renderHeader(config, { origin, scale: 2, format: "png" });
  } catch (e) {
    const msg = (e as Error).message ?? "render failed";
    const hint = /Executable doesn't exist|launch/i.test(msg)
      ? " — run `npx playwright install chromium`, or set HEADER_RENDER_URL."
      : "";
    return NextResponse.json({ error: `Render failed: ${msg}${hint}` }, { status: 500 });
  }

  const admin = createAdminClient();

  // Unique path per render so the CDN never serves a stale cover.
  const path = `${id}/${config.sizeId}-${Date.now()}.png`;
  const { error: upErr } = await admin.storage
    .from(HEADER_BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: true });
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

  const coverImageUrl = admin.storage.from(HEADER_BUCKET).getPublicUrl(path).data.publicUrl;
  const creativesUrl = body.creativesUrl?.trim() || null;

  await updateWebinar(admin, id, {
    cover_image_url: coverImageUrl,
    ...(creativesUrl ? { creatives_url: creativesUrl } : {}),
  });

  return NextResponse.json({ ok: true, coverImageUrl, creativesUrl });
}
