import Link from "next/link";
import {
  Sparkle,
  PaperPlaneTilt,
  Robot,
  ArrowRight,
  ClockCounterClockwise,
  ChatCircleText,
  FileMagnifyingGlass,
  Strategy,
  ChartLineUp,
  FileDoc,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { buddyChat } from "@/lib/data";

const familyIcons = [ChatCircleText, FileMagnifyingGlass, Strategy, ChartLineUp, FileDoc];
const familyNames = ["Communication", "Doc Extraction", "Planning", "Data Analyst", "Reports Producer"];

export default function AiHubPage() {
  return (
    <div>
      <PageHeader
        title="AI Hub"
        sub="ESG Buddy answers your questions for free. Agents do the work — extraction, analysis, planning, reports — for credits."
        action={
          <Link href="/ai-hub/agents" className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white">
            <Robot size={15} /> Browse agents <ArrowRight size={13} />
          </Link>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        {/* ESG Buddy chat */}
        <Card className="flex min-h-[560px] flex-col overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-section-fade px-5 py-4">
            <span className="grid size-10 place-items-center rounded-2xl bg-teal-900 text-green-500">
              <Sparkle size={20} weight="fill" />
            </span>
            <div className="flex-1">
              <div className="text-[14.5px] font-semibold text-ink">ESG Buddy</div>
              <div className="text-[12px] text-gray-600">Cites the content library · hands off real work to agents</div>
            </div>
            <Chip tone="green">Free · 23 of 30 messages left today</Chip>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {buddyChat.map((m, i) =>
              m.from === "user" ? (
                <div key={i} className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm bg-teal-900 p-4 text-[13.5px] leading-relaxed text-white">
                  {m.text}
                </div>
              ) : (
                <div key={i} className="flex max-w-[88%] gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-green-50 text-green-700">
                    <Sparkle size={16} weight="fill" />
                  </span>
                  <div className="rounded-2xl rounded-tl-sm bg-gray-50 p-4 text-[13.5px] leading-relaxed text-gray-800 whitespace-pre-line">
                    {m.text}
                  </div>
                </div>
              )
            )}
            <div className="flex flex-wrap gap-2 pl-11">
              <Link href="/ai-hub/agents" className="rounded-pill border border-teal-900 px-3.5 py-1.5 text-[12px] font-semibold text-teal-900 hover:bg-teal-900 hover:text-white">
                Hand to Data Analyst agent · 200 cr
              </Link>
              <Link href="/longsite" className="rounded-pill border border-gray-200 px-3.5 py-1.5 text-[12px] font-semibold text-gray-700">
                Do it manually in Longsite (+XP)
              </Link>
            </div>
          </div>

          <div className="border-t border-gray-100 p-4">
            <div className="flex items-center gap-3 rounded-pill border border-gray-200 bg-gray-50 px-5 py-3">
              <span className="flex-1 text-[13.5px] text-gray-400">Ask anything about ESG…</span>
              <PaperPlaneTilt size={18} className="text-teal-900" />
            </div>
          </div>
        </Card>

        {/* Right rail */}
        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Robot size={18} className="text-green-700" /> Agent families
            </h3>
            <div className="mt-3 space-y-2">
              {familyNames.map((n, i) => {
                const Icon = familyIcons[i];
                return (
                  <Link key={n} href="/ai-hub/agents" className="flex items-center gap-3 rounded-xl p-2.5 hover:bg-gray-50">
                    <span className="grid size-9 place-items-center rounded-xl bg-green-50 text-green-700">
                      <Icon size={18} />
                    </span>
                    <span className="flex-1 text-[13px] font-medium text-ink">{n} agents</span>
                    <ArrowRight size={13} className="text-gray-400" />
                  </Link>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ClockCounterClockwise size={17} className="text-green-700" /> Recent runs
            </h3>
            <div className="mt-3 space-y-2.5">
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-ink">Utility bill extractor</span>
                  <Chip tone="warn">Needs review</Chip>
                </div>
                <div className="mt-0.5 text-[11.5px] text-gray-600">Run #142 · 12 bills → demo workspace · 150 cr</div>
              </div>
              <div className="rounded-xl bg-gray-50 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-ink">Emissions analyst</span>
                  <Chip tone="green">Done</Chip>
                </div>
                <div className="mt-0.5 text-[11.5px] text-gray-600">Run #138 · YoY anomaly scan · 200 cr</div>
              </div>
            </div>
          </Card>

          <Card className="bg-teal-900 p-5 text-white">
            <div className="text-[13.5px] font-semibold">How pricing works</div>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-green-100/80">
              ESG Buddy is free. Agents charge credits per run — the price shows before anything
              executes, and outputs are yours to review and edit.
            </p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
