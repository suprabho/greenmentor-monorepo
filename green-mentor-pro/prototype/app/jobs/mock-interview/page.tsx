import {
  Microphone,
  Lightbulb,
  CheckCircle,
  TrendUp,
  Waveform,
  SkipForward,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { mockInterview } from "@/lib/data";

export default function MockInterviewPage() {
  return (
    <div>
      <PageHeader
        title="Mock interview"
        sub={`${mockInterview.role} · practitioner question bank · AI rubric feedback after each answer.`}
        action={<Chip tone="teal">{mockInterview.progress}</Chip>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Active question */}
        <Card className="flex flex-col p-6 md:p-8">
          <div className="flex items-center gap-2">
            <Chip tone="green">Live session</Chip>
            <Chip tone="neutral">Technical · emissions</Chip>
          </div>
          <h2 className="mt-4 text-[19px] font-semibold leading-snug tracking-tight text-ink">
            “{mockInterview.question}”
          </h2>

          <div className="mt-5 rounded-xl bg-gray-50 p-4">
            <div className="flex items-center gap-2 text-[12.5px] font-semibold text-gray-700">
              <Lightbulb size={15} className="text-[#B25E00]" /> Structure hints (hidden in exam mode)
            </div>
            <ul className="mt-2 space-y-1.5">
              {mockInterview.hints.map((h, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-gray-700">
                  <span className="text-green-700">•</span> {h}
                </li>
              ))}
            </ul>
          </div>

          {/* Recorder */}
          <div className="mt-auto pt-8">
            <div className="flex items-center justify-center gap-3 sm:gap-5">
              <button className="grid size-16 shrink-0 place-items-center rounded-full bg-danger text-white shadow-lift">
                <Microphone size={28} weight="fill" />
              </button>
              <div className="flex h-10 min-w-0 items-center gap-1 overflow-hidden">
                {[4, 9, 6, 12, 8, 14, 7, 11, 5, 9, 13, 6, 10, 4, 8].map((h, i) => (
                  <span key={i} className="w-1 rounded-pill bg-teal-700/60" style={{ height: `${h * 2.5}px` }} />
                ))}
              </div>
              <span className="text-[14px] font-semibold tabular-nums text-gray-700">01:24</span>
            </div>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button className="rounded-pill bg-teal-900 px-5 py-2 text-[13px] font-semibold text-white">Submit answer</button>
              <button className="flex items-center gap-1.5 rounded-pill border border-gray-200 px-4 py-2 text-[13px] font-semibold text-gray-700">
                <SkipForward size={14} /> Skip
              </button>
            </div>
          </div>
        </Card>

        {/* Last answer feedback */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-ink">Question 2 feedback</h3>
              <span className="flex items-center gap-1 text-[18px] font-bold text-teal-800">
                {mockInterview.lastAnswerFeedback.score}<span className="text-[12px] font-medium text-gray-500">/10</span>
              </span>
            </div>
            <div className="mt-3 space-y-3">
              <div className="flex gap-2.5 rounded-xl bg-green-50 p-3.5 text-[12.5px] leading-relaxed text-teal-800">
                <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-green-700" />
                {mockInterview.lastAnswerFeedback.good}
              </div>
              <div className="flex gap-2.5 rounded-xl bg-[#FFF8EC] p-3.5 text-[12.5px] leading-relaxed text-[#8A5800]">
                <TrendUp size={16} className="mt-0.5 shrink-0" />
                {mockInterview.lastAnswerFeedback.improve}
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Waveform size={17} className="text-green-700" /> Session plan
            </h3>
            <div className="mt-3 space-y-2">
              {[
                ["Warm-up: tell me about your transition", "done"],
                ["BRSR Core assurance basics", "done"],
                ["Emissions baseline (current)", "current"],
                ["Scope 3 estimation hierarchy", "todo"],
                ["Materiality workshop scenario", "todo"],
                ["Stakeholder pushback roleplay", "todo"],
                ["Data quality scoring", "todo"],
                ["Wrap: questions for the panel", "todo"],
              ].map(([q, state], i) => (
                <div key={i} className="flex items-center gap-2.5 text-[12.5px]">
                  <span
                    className={
                      "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold " +
                      (state === "done"
                        ? "bg-green-500 text-teal-900"
                        : state === "current"
                        ? "bg-teal-900 text-white"
                        : "bg-gray-100 text-gray-500")
                    }
                  >
                    {i + 1}
                  </span>
                  <span className={state === "todo" ? "text-gray-500" : "font-medium text-ink"}>{q}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl bg-gray-50 p-3 text-[12px] leading-relaxed text-gray-600">
              This taster session is free. Full 8-question sessions with detailed rubric reports cost <strong>250 credits</strong>.
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
