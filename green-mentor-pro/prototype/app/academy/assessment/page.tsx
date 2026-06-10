import Link from "next/link";
import {
  FlagCheckered,
  SquaresFour,
  ArrowRight,
  CheckCircle,
  Database,
  ChartBar,
  FileArrowUp,
  Lock,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";

const steps = [
  { icon: SquaresFour, title: "Open the Longsite demo workspace", desc: "Pre-loaded with Verdant Mills' FY25–26 activity data: energy, fleet, purchased goods." },
  { icon: Database, title: "Build the Scope 1 & 2 baseline", desc: "Pick the right emission factors, run the calculations, document two assumptions." },
  { icon: ChartBar, title: "Create one insight chart", desc: "Monthly emissions trend or category breakdown — your choice." },
  { icon: FileArrowUp, title: "Submit from the workspace", desc: "One click sends your workspace snapshot back to the Academy for evaluation." },
];

export default function AssessmentPage() {
  return (
    <div>
      <PageHeader
        title="Final assessment"
        sub="ESG Fundamentals · applied assignment, completed inside the Longsite Lite demo workspace."
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6 md:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-2xl bg-teal-900 text-green-500">
              <FlagCheckered size={24} weight="fill" />
            </span>
            <div>
              <h2 className="text-[18px] font-semibold tracking-tight text-ink">
                Build an emissions baseline for Verdant Mills
              </h2>
              <div className="mt-1 flex gap-2">
                <Chip tone="teal">Graded</Chip>
                <Chip tone="neutral">~90 min</Chip>
                <Chip tone="green">+100 credits on pass</Chip>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[14px] leading-relaxed text-gray-800">
            This is where the course becomes a skill. You&apos;ll work with a realistic mid-size
            manufacturer dataset and produce the same deliverable an ESG analyst would in week one
            on the job: a defensible Scope 1 &amp; 2 baseline with documented assumptions.
          </p>

          <div className="mt-6 space-y-4">
            {steps.map((s, i) => (
              <div key={i} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700">
                  <s.icon size={20} />
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-ink">{i + 1}. {s.title}</div>
                  <div className="mt-0.5 text-[13px] leading-relaxed text-gray-700">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
            <Link
              href="/longsite"
              className="flex items-center gap-2 rounded-pill bg-teal-900 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-800"
            >
              <SquaresFour size={16} /> Open Longsite demo workspace <ArrowRight size={15} weight="bold" />
            </Link>
            <span className="text-[12.5px] text-gray-600">Your progress saves automatically.</span>
          </div>
        </Card>

        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-ink">Grading rubric</h3>
            <div className="mt-3 space-y-2.5">
              {[
                ["Correct scope boundaries", "30%"],
                ["Emission factor selection", "25%"],
                ["Calculation accuracy", "25%"],
                ["Documented assumptions", "10%"],
                ["Insight chart clarity", "10%"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between text-[13px]">
                  <span className="flex items-center gap-2 text-gray-800">
                    <CheckCircle size={15} className="text-green-700" /> {k}
                  </span>
                  <span className="font-semibold text-ink">{v}</span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-[#FFE3B3] bg-[#FFF8EC] p-5">
            <h3 className="flex items-center gap-2 text-[13.5px] font-semibold text-[#8A5800]">
              <Lock size={16} /> Free-tier gate
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-[#8A5800]">
              Submitting the assessment and claiming the certificate requires an upgrade or 500
              credits. Everything before submission — including practicing in the demo workspace —
              is free.
            </p>
            <button className="mt-3 w-full rounded-pill bg-teal-900 py-2 text-[12.5px] font-semibold text-white">
              Unlock submission · 500 cr
            </button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
