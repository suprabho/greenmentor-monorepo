import Link from "next/link";
import { Card, Chip, PageHeader, ProgressBar } from "@/components/ui";
import { fetchCourseCatalog, fetchCourseTree, fetchLearnerProgress } from "@/lib/academy/repo";
import { computeCourseState } from "@/lib/academy/state";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Academy — Green Mentor Pro" };

export default async function AcademyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const courses = await fetchCourseCatalog();

  // Overall progress per enrolled course, via the same computeCourseState the
  // course overview uses so the two screens never disagree.
  const progressBySlug = new Map<string, number>();
  if (user && courses.length) {
    const { data: enrolments } = await supabase.from("enrolments").select("course_id").eq("user_id", user.id);
    const enrolledIds = new Set((enrolments ?? []).map((e) => e.course_id));
    await Promise.all(
      courses
        .filter((course) => enrolledIds.has(course.id))
        .map(async (course) => {
          const tree = await fetchCourseTree(course.slug);
          if (!tree) return;
          const { lessonProgress, moduleProgress } = await fetchLearnerProgress(user.id, tree);
          progressBySlug.set(course.slug, computeCourseState(tree, lessonProgress, moduleProgress).overallPct);
        })
    );
  }

  return (
    <div>
      <PageHeader
        title="Academy"
        sub="Bite-sized ESG courses — short videos, a quick check after every module, and real credentials."
      />

      {courses.length === 0 ? (
        <Card className="p-6 text-[13.5px] text-gray-600">No published courses yet — check back soon.</Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => {
            const pct = progressBySlug.get(course.slug);
            return (
              <Link key={course.id} href={`/academy/${course.slug}`}>
                <Card className="flex h-full flex-col p-5 transition-shadow hover:shadow-md">
                  <div className="flex items-center justify-between gap-2">
                    <Chip tone={course.priceCredits === 0 ? "green" : "neutral"}>
                      {course.priceCredits === 0 ? "Free" : `${course.priceCredits} cr`}
                    </Chip>
                    <Chip tone="teal">{course.level}</Chip>
                  </div>
                  <h2 className="mt-3 text-[15.5px] font-semibold text-ink">{course.title}</h2>
                  {course.description && <p className="mt-1.5 text-[12.5px] text-gray-600">{course.description}</p>}
                  {pct !== undefined && (
                    <div className="mt-auto pt-4">
                      <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600">
                        <span>{pct === 100 ? "Complete" : pct === 0 ? "Enrolled" : "In progress"}</span>
                        <span>{pct}%</span>
                      </div>
                      <ProgressBar value={pct} />
                    </div>
                  )}
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
