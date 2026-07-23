import Link from "next/link";
import { ArrowRight, CheckCircle, Clock, FlagCheckered, Play } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, ProgressRing } from "@/components/ui";
import { fmtDuration } from "@/lib/academy/format";

export type CourseSummary = {
  overallPct: number;
  nextUp: { title: string; moduleLabel: string } | null; // null = course complete
  continueHref: string | null;
  continueLabel: string;
  lessonsDone: number;
  lessonsTotal: number;
  gatesPassed: number;
  gatesTotal: number;
  remainingDurationS: number;
};

/** Sticky right-rail summary on the course overview (desktop only). */
export function CourseSummaryCard({ summary }: { summary: CourseSummary }) {
  const remainingLabel = fmtDuration(summary.remainingDurationS);
  return (
    <Card className="p-5">
      <div className="flex flex-col items-center text-center">
        <ProgressRing value={summary.overallPct} />
        <div className="mt-2 text-[11.5px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          Course progress
        </div>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        {summary.nextUp ? (
          <>
            <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">Next up</div>
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <div className="text-[13.5px] font-semibold leading-snug text-ink">{summary.nextUp.title}</div>
              <Chip className="shrink-0">{summary.nextUp.moduleLabel}</Chip>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2 text-[13.5px] font-semibold text-ink">
            <CheckCircle size={18} weight="fill" className="text-green-500" /> Course complete
          </div>
        )}
        {summary.continueHref && (
          <Link
            href={summary.continueHref}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-pill bg-green-500 px-5 py-2.5 text-[13px] font-bold text-teal-900 transition-opacity hover:opacity-90"
          >
            {summary.continueLabel} <ArrowRight size={14} weight="bold" />
          </Link>
        )}
      </div>

      <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-[12.5px]">
        <div className="flex items-center justify-between gap-2">
          <dt className="flex items-center gap-1.5 text-gray-600">
            <Play size={13} className="text-gray-400" /> Lessons done
          </dt>
          <dd className="font-semibold tabular-nums text-ink">
            {summary.lessonsDone}/{summary.lessonsTotal}
          </dd>
        </div>
        {summary.gatesTotal > 0 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-gray-600">
              <FlagCheckered size={13} className="text-gray-400" /> Quizzes passed
            </dt>
            <dd className="font-semibold tabular-nums text-ink">
              {summary.gatesPassed}/{summary.gatesTotal}
            </dd>
          </div>
        )}
        {remainingLabel && summary.overallPct < 100 && (
          <div className="flex items-center justify-between gap-2">
            <dt className="flex items-center gap-1.5 text-gray-600">
              <Clock size={13} className="text-gray-400" /> Est. time left
            </dt>
            <dd className="font-semibold tabular-nums text-ink">~{remainingLabel}</dd>
          </div>
        )}
      </dl>
    </Card>
  );
}
