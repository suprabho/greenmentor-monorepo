import { Card, PageHeader } from "@/components/ui";
import { WebinarCard, fmtDate } from "@/components/webinars/webinar-card";
import {
  fetchPastWebinars,
  fetchRsvpContactDefaults,
  fetchUpcomingWebinars,
  fetchUserRsvpIds,
} from "@/lib/webinars/repo";
import { EMPTY_RSVP_CONTACT } from "@/lib/webinars/contact";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Webinars & Events — Green Mentor Pro" };
export const dynamic = "force-dynamic";

export default async function WebinarsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [upcoming, past] = await Promise.all([fetchUpcomingWebinars(), fetchPastWebinars()]);
  // Prefills the RSVP form so a learner who already gave these at onboarding
  // just confirms. Signed-out visitors see "Sign in to RSVP" and never the form.
  const [rsvpIds, contactDefaults] = user
    ? await Promise.all([fetchUserRsvpIds(user.id), fetchRsvpContactDefaults(user)])
    : [new Set<string>(), EMPTY_RSVP_CONTACT];

  return (
    <div>
      <PageHeader
        title="Webinars & Events"
        sub="Free live masterclasses with GreenMentor's ESG experts — RSVP and join the next session."
      />

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">Upcoming</h2>
        {upcoming.length === 0 ? (
          <Card className="p-6 text-[13.5px] text-gray-600">
            No upcoming webinars right now — new sessions are announced every week.
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((w) => (
              <WebinarCard
                key={w.id}
                webinar={w}
                attending={rsvpIds.has(w.id)}
                signedIn={Boolean(user)}
                contactDefaults={contactDefaults}
              />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
            Past webinars
          </h2>
          <Card>
            <ul className="divide-y divide-gray-100">
              {past.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3.5">
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold text-ink">{w.title}</div>
                    {w.hook && <div className="mt-0.5 truncate text-[12px] text-gray-500">{w.hook}</div>}
                  </div>
                  <div className="shrink-0 text-[12px] text-gray-500">
                    {fmtDate(w.scheduledAt)}
                    {w.instructors.length > 0 ? ` · ${w.instructors.map((i) => i.name).join(", ")}` : ""}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
