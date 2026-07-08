import { NextResponse } from "next/server";
import { fetchQuestionAnswer } from "@/lib/academy/progress";
import { jsonError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// POST — immediate per-question correctness + explanation (PRD FR-Q-02).
// Stateless: not persisted, and only ever returns the ONE question's answer
// the caller asked about — the rest of the assessment's correct_keys never
// leave the server (questions has no client SELECT policy at all).
export async function POST(req: Request, { params }: { params: Promise<{ assessmentId: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

    const { assessmentId } = await params;
    const body = (await req.json().catch(() => ({}))) as { questionId?: string; selectedKey?: string };
    if (!body.questionId || !body.selectedKey) {
      return NextResponse.json({ error: "questionId and selectedKey are required" }, { status: 400 });
    }

    const admin = createAdminClient();
    const answer = await fetchQuestionAnswer(admin, assessmentId, body.questionId);
    if (!answer) return NextResponse.json({ error: "question not found" }, { status: 404 });

    return NextResponse.json({
      correct: answer.correctKey === body.selectedKey,
      correctKey: answer.correctKey,
      explanation: answer.explanation,
    });
  } catch (e) {
    return jsonError(e);
  }
}
