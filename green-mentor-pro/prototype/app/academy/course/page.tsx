import Link from "next/link";
import {
  CheckCircle,
  Play,
  Lock,
  Star,
  Clock,
  Users,
  Certificate,
  ArrowRight,
  Lightning,
  Fire,
  FlagCheckered,
} from "@phosphor-icons/react/dist/ssr";
import { Avatar, Card, Chip, PageHeader, ProgressBar } from "@/components/ui";
import { fundamentalModules, courseLeaderboard, avatarFor } from "@/lib/data";

export default function CoursePage() {
  return (
    <div>
      <PageHeader
        title="ESG Fundamentals"
        sub="Free with limitations · Beginner · 6 modules · 6 hrs"
        action={<Chip tone="green">Enrolled · 43% complete</Chip>}
      />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Learning path */}
        <div>
          <Card className="p-6">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[15.5px] font-semibold text-ink">Learning path</h2>
              <div className="w-40">
                <div className="mb-1 flex justify-between text-[11px] font-semibold text-gray-600">
                  <span>2 of 6 modules</span><span>43%</span>
                </div>
                <ProgressBar value={43} />
              </div>
            </div>

            <div className="space-y-0">
              {fundamentalModules.map((m, i) => (
                <div key={m.id} className="relative flex gap-4 pb-5 last:pb-0">
                  {i < fundamentalModules.length - 1 && (
                    <span className={"absolute left-[17px] top-9 h-[calc(100%-28px)] w-0.5 " + (m.state === "done" ? "bg-green-500" : "bg-gray-200")} />
                  )}
                  <span
                    className={
                      "z-10 grid size-9 shrink-0 place-items-center rounded-full " +
                      (m.state === "done"
                        ? "bg-green-500 text-teal-900"
                        : m.state === "current"
                        ? "bg-teal-900 text-white ring-4 ring-green-100"
                        : "bg-gray-100 text-gray-400")
                    }
                  >
                    {m.state === "done" ? <CheckCircle size={18} weight="fill" /> : m.state === "current" ? <Play size={15} weight="fill" /> : <Lock size={15} />}
                  </span>
                  <div
                    className={
                      "flex-1 rounded-2xl border p-4 " +
                      (m.state === "current" ? "border-teal-900 bg-white shadow-soft" : m.state === "done" ? "border-gray-100 bg-gray-50/60" : "border-gray-100 bg-white opacity-70")
                    }
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-[11.5px] font-semibold uppercase tracking-wide text-gray-500">Module {i + 1}</div>
                        <div className="text-[14.5px] font-semibold text-ink">{m.title}</div>
                        <div className="mt-0.5 text-[12px] text-gray-600">{m.lessons} lessons · {m.mins} min · gate quiz</div>
                      </div>
                      {m.state === "current" && (
                        <Link href="/academy/lesson" className="flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white">
                          Resume <ArrowRight size={13} weight="bold" />
                        </Link>
                      )}
                      {m.state === "done" && <Chip tone="green">+25 credits earned</Chip>}
                    </div>
                  </div>
                </div>
              ))}

              {/* Final assessment node */}
              <div className="relative mt-1 flex gap-4">
                <span className="z-10 grid size-9 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-400">
                  <FlagCheckered size={16} />
                </span>
                <div className="flex-1 rounded-2xl border border-dashed border-gray-300 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-[11.5px] font-semibold uppercase tracking-wide text-gray-500">Final assessment</div>
                      <div className="text-[14.5px] font-semibold text-ink">Build an emissions baseline in the Longsite demo workspace</div>
                      <div className="mt-0.5 text-[12px] text-gray-600">Applied assignment · submitted from Longsite Lite</div>
                    </div>
                    <Link href="/academy/assessment" className="text-[12.5px] font-semibold text-green-700">Preview brief →</Link>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* Right rail */}
        <aside className="space-y-4">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <Certificate size={18} className="text-green-700" /> Certificate
            </h3>
            <div className="mt-3 rounded-xl bg-section-fade p-4 text-center">
              <Certificate size={36} className="mx-auto text-teal-800" />
              <div className="mt-2 text-[13px] font-semibold text-teal-900">ESG Fundamentals — Certified</div>
              <div className="mt-1 text-[11.5px] text-gray-600">Verifiable on your Green Learning Profile</div>
            </div>
            <div className="mt-3 rounded-xl border border-[#FFE3B3] bg-[#FFF8EC] p-3 text-[12px] leading-relaxed text-[#8A5800]">
              <strong>Free-tier limitation:</strong> all lessons and quizzes are free. The final assessment and certificate unlock with any course purchase or 500 credits.
            </div>
            <button className="mt-3 w-full rounded-pill bg-green-500 py-2 text-[12.5px] font-bold text-teal-900">
              Unlock certificate · 500 cr
            </button>
          </Card>

          <Card className="p-5">
            <h3 className="text-[14px] font-semibold text-ink">Course leaderboard</h3>
            <div className="mt-3 space-y-2">
              {courseLeaderboard.map((u) => (
                <div key={u.rank} className={"flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-[12.5px] " + (u.me ? "bg-green-50" : "")}>
                  <span className="w-4 text-right font-bold text-gray-500">{u.rank}</span>
                  <Avatar src={avatarFor(u.name)} name={u.name} size={28} />
                  <span className="font-medium text-ink">{u.name}</span>
                  <span className="ml-auto flex items-center gap-1 font-semibold text-green-700">
                    <Lightning size={12} weight="fill" /> {u.xp}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="flex items-center gap-4 p-5">
            <span className="grid size-12 place-items-center rounded-2xl bg-[#FFF4E0] text-[#FF8A00]">
              <Fire size={26} weight="fill" />
            </span>
            <div>
              <div className="text-[14px] font-semibold text-ink">9-day streak</div>
              <div className="text-[12px] text-gray-600">One lesson today keeps it alive. 10 days = +50 credits.</div>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
