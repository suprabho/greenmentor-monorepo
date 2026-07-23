import Link from "next/link";
import { GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, ProgressBar } from "@/components/ui";
import { fmtDuration } from "@/lib/academy/format";
import type { Course } from "@/lib/academy/types";

/**
 * Self-paced (in-app) course card. Whole card is an internal link — no
 * external-link affordance, that's reserved for Learnyst cards. The banner is
 * a branded gradient: academy media lives in a private bucket, so there are no
 * public cover URLs to render yet.
 */
export function CourseCard({
  course,
  moduleCount,
  lessonCount,
  totalDurationS,
  progressPct,
}: {
  course: Course;
  moduleCount: number;
  lessonCount: number;
  totalDurationS: number;
  progressPct?: number;
}) {
  const durationLabel = fmtDuration(totalDurationS);
  const meta = [
    `${moduleCount} ${moduleCount === 1 ? "module" : "modules"}`,
    `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}`,
    durationLabel ? `~${durationLabel}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link href={`/academy/${course.slug}`}>
      <Card className="flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
        <div className="grid h-28 place-items-center bg-gradient-to-br from-teal-900 via-teal-800 to-green-700">
          <GraduationCap size={34} weight="fill" className="text-green-100/90" />
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-center justify-between gap-2">
            <Chip tone={course.priceCredits === 0 ? "green" : "neutral"}>
              {course.priceCredits === 0 ? "Free" : `${course.priceCredits} cr`}
            </Chip>
            <Chip tone="teal">{course.level}</Chip>
          </div>
          <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{course.title}</h3>
          {course.description && <p className="mt-1.5 text-[12.5px] text-gray-600">{course.description}</p>}
          <p className="mt-2 text-[11.5px] font-semibold text-gray-500">{meta}</p>
          {progressPct !== undefined && (
            <div className="mt-auto pt-4">
              <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600">
                <span>{progressPct === 100 ? "Complete" : progressPct === 0 ? "Enrolled" : "In progress"}</span>
                <span>{progressPct}%</span>
              </div>
              <ProgressBar value={progressPct} />
            </div>
          )}
        </div>
      </Card>
    </Link>
  );
}
