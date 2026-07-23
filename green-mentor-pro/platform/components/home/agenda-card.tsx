import Link from "next/link";
import { ArrowRight, Briefcase, CalendarDots, CaretRight, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";
import { istDayKey, type AgendaItem } from "@/lib/home/agenda";

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "Asia/Kolkata";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: TZ });
}

function dayLabel(key: string, todayKey: string, tomorrowKey: string): string {
  if (key === todayKey) return "Today";
  if (key === tomorrowKey) return "Tomorrow";
  // key is YYYY-MM-DD; noon UTC keeps the label on the right IST day.
  return new Date(`${key}T12:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: TZ,
  });
}

const KIND_TILE: Record<AgendaItem["kind"], { icon: typeof VideoCamera; className: string }> = {
  webinar: { icon: VideoCamera, className: "bg-green-50 text-green-700" },
  deadline: { icon: Briefcase, className: "bg-[#FFF4E0] text-[#B25E00]" },
  "live-course": { icon: CalendarDots, className: "bg-green-50 text-teal-800" },
};

/**
 * "Your calendar" — a 7-day strip plus an agenda list, all server-rendered.
 * Deliberately not a month grid: the data volume (a handful of webinars and
 * job deadlines) suits an agenda, and it needs no client JS or dependencies.
 */
export function AgendaCard({ items, now = new Date() }: { items: AgendaItem[]; now?: Date }) {
  const todayKey = istDayKey(now);
  const tomorrowKey = istDayKey(new Date(now.getTime() + DAY_MS));

  const kindsByDay = new Map<string, Set<AgendaItem["kind"]>>();
  for (const item of items) {
    const key = item.allDay ? item.date : istDayKey(new Date(item.date));
    const set = kindsByDay.get(key) ?? new Set();
    set.add(item.kind);
    kindsByDay.set(key, set);
  }

  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getTime() + i * DAY_MS);
    const key = istDayKey(d);
    return {
      key,
      weekday: d.toLocaleDateString("en-IN", { weekday: "narrow", timeZone: TZ }),
      dayNum: d.toLocaleDateString("en-IN", { day: "numeric", timeZone: TZ }),
      kinds: kindsByDay.get(key) ?? new Set<AgendaItem["kind"]>(),
    };
  });

  // Group the agenda by IST day, preserving the sorted order.
  const groups: { key: string; items: AgendaItem[] }[] = [];
  for (const item of items) {
    const key = item.allDay ? item.date : istDayKey(new Date(item.date));
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          <CalendarDots size={16} /> Your calendar
        </h2>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1">
        {week.map((day) => (
          <div
            key={day.key}
            className={`flex flex-col items-center gap-0.5 rounded-lg py-1.5 ${
              day.key === todayKey ? "bg-teal-900 text-white" : "text-ink"
            }`}
          >
            <span
              className={`text-[10px] font-semibold uppercase ${
                day.key === todayKey ? "text-green-100/80" : "text-gray-500"
              }`}
            >
              {day.weekday}
            </span>
            <span className="text-[13px] font-semibold tabular-nums">{day.dayNum}</span>
            <span className="flex h-1 gap-0.5">
              {day.kinds.has("webinar") && <span className="size-1 rounded-full bg-green-500" />}
              {day.kinds.has("deadline") && <span className="size-1 rounded-full bg-warning" />}
              {day.kinds.has("live-course") && <span className="size-1 rounded-full bg-teal-700" />}
            </span>
          </div>
        ))}
      </div>

      {groups.length === 0 ? (
        <div className="mt-5 border-t border-gray-100 pt-4 text-[12.5px] text-gray-500">
          Nothing scheduled in the next 3 weeks.{" "}
          <Link href="/webinars" className="font-semibold text-green-700 hover:underline">
            Browse webinars <ArrowRight size={11} className="inline" />
          </Link>
        </div>
      ) : (
        <div className="mt-5 space-y-4 border-t border-gray-100 pt-4">
          {groups.map((group) => (
            <div key={group.key}>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                {dayLabel(group.key, todayKey, tomorrowKey)}
              </div>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const tile = KIND_TILE[item.kind];
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-gray-50"
                      >
                        <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tile.className}`}>
                          <tile.icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-ink">{item.title}</span>
                          <span className="block truncate text-[11.5px] text-gray-500">
                            {item.allDay ? "Application deadline" : `${fmtTime(item.date)} IST`}
                            {item.meta ? ` · ${item.meta}` : ""}
                          </span>
                        </span>
                        <CaretRight size={13} className="shrink-0 text-gray-300" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
