import { Card, PageHeader } from "@/components/ui";
import { BundleCard } from "@/components/academy/bundle-card";
import { CourseCard } from "@/components/academy/course-card";
import { LiveCourseCard } from "@/components/academy/live-course-card";
import { liveCourses, plusEssentialBundle } from "@/lib/academy/catalog-extras";
import { sumDurations } from "@/lib/academy/format";
import { fetchCourseCatalog, fetchCourseTree, fetchLearnerProgress } from "@/lib/academy/repo";
import { computeCourseState } from "@/lib/academy/state";
import type { CourseTree } from "@/lib/academy/types";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Academy — Green Mentor Pro" };

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">{children}</h2>
  );
}

export default async function AcademyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const courses = await fetchCourseCatalog();

  // Course trees give the card meta line (modules · lessons · duration); the
  // catalog is tiny, so per-course fetches are fine. Progress reuses the same
  // computeCourseState as the course overview so the two screens never disagree.
  const treeBySlug = new Map<string, CourseTree>();
  await Promise.all(
    courses.map(async (course) => {
      const tree = await fetchCourseTree(course.slug);
      if (tree) treeBySlug.set(course.slug, tree);
    })
  );

  const progressBySlug = new Map<string, number>();
  if (user && courses.length) {
    const { data: enrolments } = await supabase.from("enrolments").select("course_id").eq("user_id", user.id);
    const enrolledIds = new Set((enrolments ?? []).map((e) => e.course_id));
    await Promise.all(
      courses
        .filter((course) => enrolledIds.has(course.id))
        .map(async (course) => {
          const tree = treeBySlug.get(course.slug);
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

      <section>
        <SectionHeading>Self-paced courses</SectionHeading>
        {courses.length === 0 ? (
          <Card className="p-6 text-[13.5px] text-gray-600">No published courses yet — check back soon.</Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => {
              const tree = treeBySlug.get(course.slug);
              const lessons = tree?.modules.flatMap((m) => m.lessons) ?? [];
              return (
                <CourseCard
                  key={course.id}
                  course={course}
                  moduleCount={tree?.modules.length ?? 0}
                  lessonCount={lessons.length}
                  totalDurationS={sumDurations(lessons)}
                  progressPct={progressBySlug.get(course.slug)}
                />
              );
            })}
          </div>
        )}
      </section>

      {liveCourses.length > 0 && (
        <section className="mt-10">
          <SectionHeading>Live training</SectionHeading>
          <div className="grid gap-4 sm:grid-cols-2">
            {liveCourses.map((course) => (
              <LiveCourseCard key={course.id} course={course} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <SectionHeading>Bundles</SectionHeading>
        <BundleCard bundle={plusEssentialBundle} />
      </section>
    </div>
  );
}
