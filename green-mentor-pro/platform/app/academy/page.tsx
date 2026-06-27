import { ComingSoon } from "@/components/coming-soon";

export const metadata = { title: "Academy — Green Mentor Pro" };

export default function AcademyPage() {
  return (
    <ComingSoon
      title="Academy"
      sub="Courses & live webinars"
      tone="green"
      points={[
        "Structured ESG / BRSR courses (Vizmaya-sourced catalog)",
        "Live webinars with RSVP that flows into your Calendar",
        "Recognized certifications and CV-ready projects",
      ]}
    />
  );
}
