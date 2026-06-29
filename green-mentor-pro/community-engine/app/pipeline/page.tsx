import { FlowArrow } from "@phosphor-icons/react/dist/ssr";
import { Card, PageHeader } from "@/components/ui";
import { AdminTabs, type AdminTab } from "@/components/admin-tabs";
import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_SECTIONS } from "@/lib/admin/sections";

export const metadata = { title: "Pipeline — GreenMentor Community" };

/** Tab strip derived from the section registry — soon sections show muted. */
const tabs: AdminTab[] = ADMIN_SECTIONS.map((s) => ({
  href: s.href,
  label: s.name,
  exact: s.href === "/pipeline",
  soon: s.status === "soon",
}));

export default async function PipelinePage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        title="Pipeline"
        sub="The production board for community content — idea to published."
      />
      <div className="mb-6">
        <AdminTabs tabs={tabs} />
      </div>

      <Card className="grid place-items-center p-12 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-green-50 text-green-700">
          <FlowArrow size={24} />
        </span>
        <h3 className="mt-4 text-[15px] font-semibold text-ink">Pipeline is taking shape</h3>
        <p className="mt-1 max-w-md text-[13px] leading-relaxed text-gray-600">
          This is where community content will move through stages — drafting,
          review, scheduled and published. Hook up the board and stage columns here.
        </p>
      </Card>
    </div>
  );
}
