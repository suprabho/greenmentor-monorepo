import Link from "next/link";
import {
  FilePdf,
  CheckCircle,
  Warning,
  ArrowRight,
  ArrowsClockwise,
  GraduationCap,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { cvReport } from "@/lib/data";

export default function ScreenCvPage() {
  return (
    <div>
      <PageHeader
        title="Screen CV"
        sub="Your CV, analyzed against a target role: ATS readiness, skill gaps, and rewrites that quantify your impact."
        action={
          <button className="flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-4 py-2 text-[12.5px] font-semibold text-gray-800">
            <ArrowsClockwise size={14} /> Re-run · 150 cr
          </button>
        }
      />

      {/* File + score band */}
      <Card className="mb-6 p-5">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-11 place-items-center rounded-xl bg-red-50 text-[#C0392B]">
            <FilePdf size={24} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold text-ink">{cvReport.fileName}</div>
            <div className="text-[12.5px] text-gray-600">Target role: {cvReport.targetRole} · analyzed just now · free screen used</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-[26px] font-bold text-teal-800">{cvReport.atsScore}</div>
              <div className="text-[11px] font-medium uppercase tracking-wide text-gray-500">ATS score / 100</div>
            </div>
            <div className="h-12 w-px bg-gray-200" />
            <Chip tone="warn">3 gaps found</Chip>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="text-[15px] font-semibold text-ink">What&apos;s working</h3>
          <div className="mt-3 space-y-3">
            {cvReport.strengths.map((s, i) => (
              <div key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-gray-800">
                <CheckCircle size={17} weight="fill" className="mt-0.5 shrink-0 text-green-700" />
                {s}
              </div>
            ))}
          </div>

          <h3 className="mt-7 text-[15px] font-semibold text-ink">Suggested rewrites</h3>
          <div className="mt-3 space-y-3">
            {cvReport.rewrites.map((r, i) => (
              <div key={i} className="rounded-xl border border-gray-100 p-4">
                <div className="text-[12.5px] text-gray-500 line-through">{r.before}</div>
                <div className="mt-1.5 text-[13px] font-medium leading-relaxed text-teal-800">{r.after}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-[15px] font-semibold text-ink">Skill gaps → courses that close them</h3>
          <p className="mt-1 text-[12.5px] text-gray-600">Each gap links to the exact module in the Academy.</p>
          <div className="mt-4 space-y-3">
            {cvReport.gaps.map((g, i) => (
              <div key={i} className="rounded-xl bg-gray-50 p-4">
                <div className="flex items-start gap-2.5">
                  <Warning size={17} weight="fill" className="mt-0.5 shrink-0 text-[#B25E00]" />
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold text-ink">{g.gap}</div>
                    <div className="mt-0.5 text-[12.5px] text-gray-600">Fix: {g.fix}</div>
                  </div>
                </div>
                <Link
                  href="/academy"
                  className="mt-2.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-green-700"
                >
                  <GraduationCap size={15} /> {g.course} <ArrowRight size={12} />
                </Link>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-xl bg-teal-900 p-4 text-white">
            <div className="text-[13px] font-semibold">Deep report</div>
            <p className="mt-1 text-[12px] leading-relaxed text-green-100/80">
              Line-by-line rewrite of your full CV + a tailored cover letter for this role.
            </p>
            <button className="mt-2.5 rounded-pill bg-green-500 px-4 py-1.5 text-[12px] font-bold text-teal-900">
              Generate · 400 cr
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
