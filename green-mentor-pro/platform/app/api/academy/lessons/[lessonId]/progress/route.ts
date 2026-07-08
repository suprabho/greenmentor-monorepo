import { NextResponse } from "next/server";
import { applyLessonProgress } from "@/lib/academy/progress";
import type { Range } from "@/lib/academy/ranges";
import { AcademyApiError } from "@/lib/academy/errors";
import { jsonError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST — flush accumulated watch segments for a lesson. The server merges
// them into the authoritative watched_ranges union and recomputes
// pct_watched/completion itself (PRD §6.2 FR-V-04) — the client's segments
// are raw play-head data, never a trusted "done" flag.
export async function POST(req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

    const { lessonId } = await params;
    const body = (await req.json().catch(() => ({}))) as { segments?: Range[] };
    const segments = Array.isArray(body.segments) ? body.segments : [];

    const admin = createAdminClient();
    const result = await applyLessonProgress(admin, user.id, lessonId, segments);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AcademyApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return jsonError(e);
  }
}
