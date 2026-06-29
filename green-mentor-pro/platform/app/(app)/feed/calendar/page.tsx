import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Calendar — Green Mentor Pro" };

export default function CalendarPage() {
  return (
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
  );
}
