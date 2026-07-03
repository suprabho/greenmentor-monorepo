/**
 * Entity curation for the Pipeline tab.
 *
 * POST → add an entity to the feed's follow-graph vocabulary. Body
 *        { name: string, kind: 'framework'|'topic'|'region'|'company',
 *          slug?: string } — slug is derived from the name when omitted.
 *        The ingest worker steers the summarizer toward existing entities, so
 *        curating them here shapes future tagging.
 *
 * Writes go through the service-role client (entities are public-read /
 * worker-write under RLS), so the route is admin-allowlist gated and returns
 * `mode: 'unconfigured'` when SUPABASE_SERVICE_ROLE_KEY isn't set (local dev
 * without the worker key) — mirroring the workers route's convention.
 */

import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KINDS = ["framework", "topic", "region", "company"] as const;
type Kind = (typeof KINDS)[number];

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** kebab-case a display name into a slug ("CSRD / ESRS" → "csrd-esrs"). */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!isAdmin(user.email)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    kind?: string;
    slug?: string;
  };

  const name = body.name?.trim();
  const kind = body.kind?.trim() as Kind | undefined;
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!kind || !KINDS.includes(kind)) {
    return NextResponse.json({ error: `kind must be one of: ${KINDS.join(", ")}` }, { status: 400 });
  }
  const slug = body.slug?.trim() || slugify(name);
  if (!SLUG_RE.test(slug)) {
    return NextResponse.json(
      { error: "slug must be kebab-case (lowercase letters, digits, hyphens)" },
      { status: 400 }
    );
  }

  if (!isServiceRoleConfigured()) {
    return NextResponse.json({ ok: true, mode: "unconfigured" });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin.from("entities").select("id, name, kind").eq("slug", slug).maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: `'${slug}' already exists (${existing.name}, ${existing.kind})` },
      { status: 409 }
    );
  }

  const { data: entity, error } = await admin
    .from("entities")
    .insert({ slug, name, kind })
    .select("id, slug, name, kind")
    .single();
  if (error || !entity) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "created", entity });
}
