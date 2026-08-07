/**
 * PATCH → set or clear a news article's image_url.
 *
 * The only writable field. Articles are otherwise owned by the platform's RSS
 * worker; this exists so an editor can give a picture to the items that never
 * get one automatically (SEBI notices, wire copy with no og:image).
 *
 * Same admin-allowlist gate + service-role write as /api/instructors.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { updateNewsImage } from "@/lib/db/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Accept a hosted http(s) URL or an explicit clear; reject data:/javascript:. */
function parseImageUrl(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false, error: "image_url must be a string or null" };

  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, value: null };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "image_url must be an absolute http(s) URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { ok: false, error: "image_url must be an absolute http(s) URL" };
  }
  return { ok: true, value: parsed.href };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!("image_url" in body)) return NextResponse.json({ error: "image_url is required" }, { status: 400 });

  const image = parseImageUrl(body.image_url);
  if (!image.ok) return NextResponse.json({ error: image.error }, { status: 400 });

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  try {
    const article = await updateNewsImage(createAdminClient(), id, image.value);
    return NextResponse.json({ ok: true, article });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "update failed" }, { status: 500 });
  }
}
