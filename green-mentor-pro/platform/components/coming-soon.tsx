import { Card, Chip, PageHeader } from "@/components/ui";

/**
 * Navigable "coming soon" stub for roadmap surfaces. Green-scope surfaces
 * (Academy, Calendar) list what's planned; out-of-scope ones just hold the route.
 */
export function ComingSoon({
  title,
  sub,
  points,
  tone = "neutral",
}: {
  title: string;
  sub: string;
  points?: string[];
  tone?: "green" | "neutral";
}) {
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={title} sub={sub} action={<Chip tone={tone === "green" ? "green" : "neutral"}>Coming soon</Chip>} />
      <Card className="space-y-4 p-6">
        <p className="text-[14px] leading-relaxed text-gray-700">
          This surface is on the Green Mentor Pro roadmap and isn&apos;t live yet.
        </p>
        {points && points.length > 0 && (
          <ul className="space-y-2 text-[13.5px] text-gray-600">
            {points.map((p) => (
              <li key={p} className="flex gap-2.5">
                <span className="mt-0.5 text-green-700">•</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
