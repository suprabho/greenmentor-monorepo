import {
  ArrowSquareOut,
  Broadcast,
  CalendarBlank,
  GraduationCap,
  Clock,
  UsersThree,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { cohortLabel } from "@/lib/academy/catalog";
import type { CatalogCourse } from "@/lib/academy/types";

/** Standalone INR price, e.g. "₹6,999" — same formatting as the pricing page. */
function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

/**
 * A course hosted on Learnyst — either an instructor-led live programme or a
 * self-paced track. Only the labeled CTA leaves the app (always with the
 * external-link icon); the card itself is not clickable, so in-app vs external
 * navigation stays unambiguous.
 */
export function LearnystCourseCard({ course }: { course: CatalogCourse }) {
  const isLive = course.delivery === "live";
  const meta = [
    course.moduleCount ? `${course.moduleCount} modules` : null,
    course.lessonCount ? `${course.lessonCount} lessons` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex h-28 items-center justify-between bg-gradient-to-br from-teal-900 to-teal-800 px-5">
        <div className="flex items-center gap-2.5 text-green-100/90">
          {isLive ? <Broadcast size={28} weight="fill" /> : <GraduationCap size={28} weight="fill" />}
          <span className="text-[12px] font-semibold uppercase tracking-[0.1em]">{course.framework}</span>
        </div>
        {isLive && (
          <Chip tone="danger">
            <span className="size-1.5 animate-pulse rounded-full bg-danger" /> Live
          </Chip>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <Chip tone="teal">{course.level}</Chip>
          {course.priceInr != null && course.priceInr > 0 && (
            <span className="text-[13px] font-semibold text-ink">{formatINR(course.priceInr)}</span>
          )}
        </div>
        <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{course.title}</h3>
        <p className="mt-1.5 text-[12.5px] text-gray-600">{course.description}</p>
        <div className="mt-3 space-y-1.5 text-[12.5px] text-gray-600">
          {/* Cohort dates only mean something for live programmes. */}
          {isLive ? (
            <div className="flex items-center gap-2">
              <CalendarBlank size={14} className="shrink-0 text-gray-400" />
              {cohortLabel(course)}
            </div>
          ) : (
            (course.durationLabel || meta) && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="shrink-0 text-gray-400" />
                {[course.durationLabel, meta].filter(Boolean).join(" · ")}
              </div>
            )
          )}
          {course.instructors.length > 0 && (
            <div className="flex items-center gap-2">
              <UsersThree size={14} className="shrink-0 text-gray-400" />
              {course.instructors.join(" · ")}
            </div>
          )}
        </div>
        <div className="mt-auto pt-4">
          <a
            href={course.courseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800"
          >
            Enrol on Learnyst <ArrowSquareOut size={13} />
          </a>
          <p className="mt-2 text-[11px] text-gray-500">Hosted on Learnyst — opens in a new tab.</p>
        </div>
      </div>
    </Card>
  );
}
