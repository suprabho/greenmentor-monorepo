import Link from "next/link";
import { ArrowRight, Books, Clock, Play, SealCheck } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, ProgressBar } from "@/components/ui";
import { fmtDuration } from "@/lib/academy/format";
import type { Course } from "@/lib/academy/types";

const LEVEL_LABEL: Record<Course["level"], string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

/**
 * Course overview hero. Desktop keeps progress + CTA in the sticky summary
 * card; on mobile they render inline here instead.
 */
export function CourseHero({
  course,
  moduleCount,
  lessonCount,
  totalDurationS,
  hasGates,
  overallPct,
  continueHref,
  continueLabel,
}: {
  course: Course;
  moduleCount: number;
  lessonCount: number;
  totalDurationS: number;
  hasGates: boolean;
  overallPct: number;
  continueHref: string | null;
  continueLabel: string;
}) {
  const durationLabel = fmtDuration(totalDurationS);
  const meta: { icon: React.ReactNode; label: string }[] = [
    { icon: <Books size={14} />, label: `${moduleCount} ${moduleCount === 1 ? "module" : "modules"}` },
    { icon: <Play size={14} />, label: `${lessonCount} ${lessonCount === 1 ? "lesson" : "lessons"}` },
    ...(durationLabel ? [{ icon: <Clock size={14} />, label: `~${durationLabel}` }] : []),
    ...(hasGates ? [{ icon: <SealCheck size={14} />, label: "Gate quizzes" }] : []),
  ];

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-teal-900 to-green-500" />
      <div className="p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone="teal">{LEVEL_LABEL[course.level]}</Chip>
          <Chip tone={course.priceCredits === 0 ? "green" : "neutral"}>
            {course.priceCredits === 0 ? "Free" : `${course.priceCredits} cr`}
          </Chip>
        </div>
        <h1 className="mt-3 text-[24px] font-semibold tracking-tight text-ink lg:text-[28px]">
          {course.title}
        </h1>
        {course.description && (
          <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-gray-700">{course.description}</p>
        )}
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-gray-600">
          {meta.map((m) => (
            <span key={m.label} className="flex items-center gap-1.5">
              <span className="text-gray-400">{m.icon}</span>
              {m.label}
            </span>
          ))}
        </div>

        {/* Mobile-only progress + CTA (desktop versions live in the summary card) */}
        <div className="mt-5 lg:hidden">
          <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-gray-600">
            <span>Course progress</span>
            <span>{overallPct}%</span>
          </div>
          <ProgressBar value={overallPct} />
          {continueHref && (
            <Link
              href={continueHref}
              className="mt-4 inline-flex items-center gap-2 rounded-pill bg-green-500 px-5 py-2.5 text-[13px] font-bold text-teal-900"
            >
              {continueLabel} <ArrowRight size={14} weight="bold" />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
