import { NextResponse } from "next/server";
import { AcademyApiError } from "@/lib/academy/errors";
import { applyAssessmentSubmit } from "@/lib/academy/progress";
import { jsonError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST — authoritative scoring. The server re-derives correctness from the
// questions table itself; it never trusts a client-supplied "correct" flag.
// On first pass, cascades module/course completion and gamification awards.
export async function POST(req: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

    const { assessmentId } = await params;
    const body = (await req.json().catch(() => ({}))) as {
      answers?: { questionId: string; selectedKey: string }[];
    };
    const answers = Array.isArray(body.answers) ? body.answers : [];

    const admin = createAdminClient();
    const result = await applyAssessmentSubmit(admin, user.id, assessmentId, answers);
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AcademyApiError) return NextResponse.json({ error: e.message }, { status: e.status });
    return jsonError(e);
  }
}
