import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

// GET — sign a short-lived URL for the lesson's video object in the private
// academy-videos bucket. 404s (rather than a broken player) when the object
// hasn't been uploaded yet — real courses will hit this mid-upload too.
export async function GET(_req: Request, { params }: { params: Promise<{ lessonId: string }> }) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "not authenticated" }, { status: 401 });

    const { lessonId } = await params;
    const admin = createAdminClient();

    const { data: lesson, error: lessonErr } = await admin
      .from("lessons")
      .select("id, video_object_path, modules(course_id)")
      .eq("id", lessonId)
      .maybeSingle();
    if (lessonErr) return jsonError(lessonErr);
    if (!lesson) return NextResponse.json({ error: "lesson not found" }, { status: 404 });
    if (!lesson.video_object_path) {
      return NextResponse.json({ error: "video not yet uploaded for this lesson" }, { status: 404 });
    }

    const courseId = (lesson.modules as unknown as { course_id: string } | null)?.course_id;
    if (courseId) {
      // Auto-enrol defensively (D4): the learner should already be enrolled
      // from visiting the course overview, but a direct/bookmarked hit on
      // this route shouldn't be blocked — the course is free either way.
      await admin
        .from("enrolments")
        .upsert({ user_id: user.id, course_id: courseId }, { onConflict: "user_id,course_id", ignoreDuplicates: true });
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("academy-videos")
      .createSignedUrl(lesson.video_object_path, SIGNED_URL_TTL_SECONDS);
    if (signErr || !signed) {
      return NextResponse.json({ error: signErr?.message ?? "video not found" }, { status: 404 });
    }

    return NextResponse.json({ url: signed.signedUrl, expiresIn: SIGNED_URL_TTL_SECONDS });
  } catch (e) {
    return jsonError(e);
  }
}
