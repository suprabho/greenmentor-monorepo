import { VideoCamera, ListChecks, Coins, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { webinars, esgTasks } from "@/lib/data";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// June 2026: June 1 is a Monday.
const eventDays: Record<number, string> = { 12: "task", 15: "task", 16: "webinar", 18: "task", 19: "webinar", 20: "task", 24: "webinar" };

export default function CalendarPage() {
  return (
    <div>
      <PageHeader
        title="Calendar"
        sub="Upcoming webinars and your existing ESG plans and tasks, in one place."
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Month grid */}
        <Card className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-ink">June 2026</h2>
            <div className="flex gap-3 text-[11.5px] font-medium text-gray-600">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-green-500" /> Webinar</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-teal-700" /> ESG task</span>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {days.map((d) => (
              <div key={d} className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">{d}</div>
            ))}
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
              const ev = eventDays[d];
              const today = d === 10;
              return (
                <div
                  key={d}
                  className={
                    "relative flex aspect-square flex-col items-center justify-center rounded-xl text-[13px] " +
                    (today
                      ? "bg-teal-900 font-bold text-white"
                      : ev
                      ? "bg-gray-50 font-semibold text-ink"
                      : "text-gray-700 hover:bg-gray-50")
                  }
                >
                  {d}
                  {ev && (
                    <span
                      className={
                        "absolute bottom-1.5 size-1.5 rounded-full " +
                        (ev === "webinar" ? "bg-green-500" : "bg-teal-700")
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Agenda */}
        <div className="space-y-4">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <VideoCamera size={18} className="text-green-700" /> Upcoming webinars
            </h3>
            <div className="mt-3 space-y-3">
              {webinars.map((w) => (
                <div key={w.id} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3.5">
                  <div className="w-12 shrink-0 text-center">
                    <div className="text-[11px] font-bold uppercase text-green-700">{w.date.split(" ")[0]}</div>
                    <div className="text-[20px] font-semibold leading-none text-ink">{w.date.split(" ")[1]}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold leading-snug text-ink">{w.title}</div>
                    <div className="mt-0.5 text-[12px] text-gray-600">{w.time} · {w.speaker}</div>
                    <div className="mt-2 flex items-center gap-2">
                      <Chip tone="green"><Coins size={11} weight="fill" /> +{w.credits} credits</Chip>
                      {w.rsvp ? (
                        <Chip tone="teal"><CheckCircle size={11} weight="fill" /> RSVP&apos;d</Chip>
                      ) : (
                        <button className="rounded-pill border border-teal-900 px-3 py-0.5 text-[11.5px] font-semibold text-teal-900 hover:bg-teal-900 hover:text-white">
                          RSVP
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="flex items-center gap-2 text-[14px] font-semibold text-ink">
              <ListChecks size={18} className="text-green-700" /> Your ESG plans & tasks
            </h3>
            <div className="mt-3 space-y-2.5">
              {esgTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3.5">
                  <span className="size-4 shrink-0 rounded-md border-2 border-gray-300" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-ink">{t.title}</div>
                    <div className="text-[11.5px] text-gray-600">{t.date} · {t.type}</div>
                  </div>
                  <Chip tone={t.due.startsWith("+") ? "green" : "warn"}>{t.due}</Chip>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
