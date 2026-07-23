import type { Job } from "@/lib/jobs/repo";
import type { Webinar } from "@/lib/webinars/repo";

/**
 * The Home dashboard's consolidated calendar. There is no events table yet —
 * "events" today = webinars (timestamped) + job application deadlines
 * (date-only). The `live-course` kind is reserved for when live-training
 * cohorts get real dates (none exist in any data source yet).
 */
export type AgendaItem = {
  id: string;
  kind: "webinar" | "deadline" | "live-course";
  /** ISO timestamp for webinars; YYYY-MM-DD for all-day deadlines. */
  date: string;
  allDay: boolean;
  title: string;
  meta: string | null;
  href: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in IST — the app's display timezone — for day-bucketing. */
export function istDayKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function buildAgenda(webinars: Webinar[], jobs: Job[], horizonDays = 21, now = new Date()): AgendaItem[] {
  const todayKey = istDayKey(now);
  const horizon = new Date(now.getTime() + horizonDays * DAY_MS);
  const horizonKey = istDayKey(horizon);

  const items: AgendaItem[] = [];

  for (const w of webinars) {
    if (!w.scheduledAt) continue;
    const key = istDayKey(new Date(w.scheduledAt));
    if (key < todayKey || key > horizonKey) continue;
    items.push({
      id: `webinar-${w.id}`,
      kind: "webinar",
      date: w.scheduledAt,
      allDay: false,
      title: w.title,
      meta:
        [w.instructors.map((i) => i.name).join(", ") || null, w.durationMinutes ? `${w.durationMinutes} min` : null]
          .filter(Boolean)
          .join(" · ") || null,
      href: "/webinars",
    });
  }

  for (const j of jobs) {
    if (!j.applicationDeadline) continue;
    // application_deadline is a date-only column; compare as day keys.
    if (j.applicationDeadline < todayKey || j.applicationDeadline > horizonKey) continue;
    items.push({
      id: `deadline-${j.id}`,
      kind: "deadline",
      date: j.applicationDeadline,
      allDay: true,
      title: j.title,
      meta: j.company,
      href: "/jobs",
    });
  }

  return items.sort((a, b) => a.date.localeCompare(b.date));
}
