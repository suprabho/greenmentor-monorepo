import Link from "next/link";
import { ArrowRight, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { Card } from "@/components/ui";
import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Calendar — Green Mentor Pro" };

export default function CalendarPage() {
  return (
    <div className="space-y-5">
      <ComingSoon
        title="Calendar"
        sub="Regulatory deadlines & upcoming webinars"
        tone="green"
        points={[
          "BRSR / CSRD / SEC filing and assurance deadlines",
          "Upcoming webinars and live training (RSVP)",
          "Your ESG engagement tasks, in one timeline",
        ]}
      />
      <div className="mx-auto max-w-2xl">
        <Link href="/webinars">
          <Card className="group flex items-center justify-between gap-3 p-5 transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700">
                <VideoCamera size={20} />
              </span>
              <div>
                <div className="text-[14px] font-semibold text-ink">Upcoming webinars are live</div>
                <div className="text-[12.5px] text-gray-600">Browse the schedule and RSVP to the next session.</div>
              </div>
            </div>
            <ArrowRight size={16} className="shrink-0 text-green-700 transition-transform group-hover:translate-x-0.5" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
