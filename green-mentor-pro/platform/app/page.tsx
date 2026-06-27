import Link from "next/link";
import { Card, Chip, PageHeader } from "@/components/ui";

export default function Home() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Green Mentor Pro"
        sub="Unified ESG platform — convergence vertical slice"
      />

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Chip tone="green">Increment 1 · Step 1</Chip>
          <span className="text-[13px] text-gray-600">Monorepo + vismay seam</span>
        </div>
        <p className="text-[14px] leading-relaxed text-gray-700">
          The platform app is live on Next 16 inside the GreenMentor pnpm
          workspace. The <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12.5px]">@vismay/viz-engine</code> submodule
          resolves via <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[12.5px]">workspace:*</code> and is
          transpiled in-place — no build step.
        </p>
        <Link
          href="/viz-demo"
          className="inline-flex items-center rounded-pill bg-teal-900 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-teal-800"
        >
          See a viz-engine chart render →
        </Link>
      </Card>
    </div>
  );
}
