/**
 * POST → publish this saved share card to the learner platform: render the
 * card's SAVED config to PNG (the same pipeline as the download export),
 * upload it to the public `share-cards` bucket, and upsert the card's row in
 * community_share_card_publications — which the platform's News feed (/feed)
 * reads through the share_cards_public view and interleaves with articles.
 * Body: { caption?: string }. Re-publishing replaces the image + metadata.
 *
 * DELETE → unpublish: remove the publication row and the card's rendered
 * images from the bucket.
 *
 * Admin-allowlist gated like the export route; publication writes go through
 * the service-role client like the webinar header route
 * (app/api/webinars/[id]/header).
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import {
  deleteShareCardPublication,
  getShareCard,
  upsertShareCardPublication,
} from "@/lib/db/shareCards";
import { renderErrorHint, renderShareCard } from "@/lib/share-cards/renderCard";
import { normalizeSnapshot } from "@/lib/share-cards/types";

// Playwright needs the Node runtime (not Edge) and time to drive a browser —
// same budget as the export route.
export const runtime = "nodejs";
export const maxDuration = 300;

const SHARE_CARDS_BUCKET = "share-cards";

async function requireAdminGate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { denied: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!isAdmin(user.email)) {
    return { denied: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  }
  return { supabase, user };
}

function serviceRoleMissing(): NextResponse {
  return NextResponse.json(
    { error: "Publishing isn't configured — set SUPABASE_SERVICE_ROLE_KEY (the worker write key)." },
    { status: 503 }
  );
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminGate();
  if ("denied" in gate) return gate.denied;
  const { supabase, user } = gate;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return serviceRoleMissing();

  const body = (await req.json().catch(() => ({}))) as { caption?: string };
  const caption = typeof body.caption === "string" ? body.caption.trim() || null : null;

  // The session client, so RLS decides visibility: admins can publish their
  // own cards and anything shared with the team.
  const row = await getShareCard(supabase, id).catch(() => null);
  if (!row) {
    return NextResponse.json({ error: "Card not found (or not shared with you)." }, { status: 404 });
  }

  const snapshot = normalizeSnapshot(row.config);
  if (snapshot.foreground.length === 0) {
    return NextResponse.json({ error: "The card has no layers to publish." }, { status: 400 });
  }

  let bytes: Buffer;
  try {
    const origin = new URL(req.url).origin;
    bytes = await renderShareCard(supabase, snapshot, { origin, format: "png" });
  } catch (e) {
    const msg = (e as Error).message ?? "render failed";
    return NextResponse.json({ error: `Render failed: ${msg}${renderErrorHint(msg)}` }, { status: 500 });
  }

  const admin = createAdminClient();

  // Unique path per publish so the CDN never serves a stale card.
  const path = `${id}/${Date.now()}.png`;
  const { error: upErr } = await admin.storage
    .from(SHARE_CARDS_BUCKET)
    .upload(path, bytes, { contentType: "image/png", upsert: true });
  if (upErr) {
    const missing = /not found|does not exist|bucket/i.test(upErr.message);
    return NextResponse.json(
      {
        error: missing
          ? `Upload failed — the "${SHARE_CARDS_BUCKET}" bucket is missing. Apply migration 0019.`
          : `Upload failed: ${upErr.message}`,
      },
      { status: 500 }
    );
  }

  const imageUrl = admin.storage.from(SHARE_CARDS_BUCKET).getPublicUrl(path).data.publicUrl;

  try {
    const publication = await upsertShareCardPublication(admin, {
      card_id: id,
      title: row.title,
      caption,
      ratio: snapshot.ratio,
      image_url: imageUrl,
      published_by: user.id,
    });
    return NextResponse.json({ ok: true, publication });
  } catch (e) {
    const msg = (e as Error).message ?? "publish failed";
    const missing = /community_share_card_publications/i.test(msg);
    return NextResponse.json(
      {
        error: missing
          ? `Publish failed — the publications table is missing: apply supabase/migrations/0019_share_card_publications.sql in the Supabase SQL editor.`
          : `Publish failed: ${msg}`,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminGate();
  if ("denied" in gate) return gate.denied;
  const { id } = await params;

  if (!isServiceRoleConfigured()) return serviceRoleMissing();

  const admin = createAdminClient();
  try {
    await deleteShareCardPublication(admin, id);
  } catch (e) {
    return NextResponse.json({ error: `Unpublish failed: ${(e as Error).message}` }, { status: 500 });
  }

  // Best-effort: drop the rendered images so the public URLs stop resolving.
  // The row is already gone, so a storage hiccup here doesn't fail the request.
  try {
    const { data: files } = await admin.storage.from(SHARE_CARDS_BUCKET).list(id);
    if (files && files.length > 0) {
      await admin.storage
        .from(SHARE_CARDS_BUCKET)
        .remove(files.map((f) => `${id}/${f.name}`));
    }
  } catch {
    // ignore — orphaned files in a cache-busted path are harmless
  }

  return NextResponse.json({ ok: true });
}
