import { PageHeader, Chip } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { MaterialityDashboard } from "@/components/msci/materiality-dashboard";
import {
  MaterialityExplorer,
  type ExplorerIndustry,
  type ExplorerIssue,
} from "@/components/msci/materiality-explorer";
import {
  MSCI_INDUSTRIES,
  MSCI_AS_OF,
  WEIGHTED_ISSUE_ORDER,
  MSCI_KEY_ISSUE_BY_ID,
} from "@/lib/msci/materiality-map";

export const metadata = { title: "MSCI ESG Materiality Map — GreenMentor Community" };

// Plain, serializable props for the client explorer (weights/relevance → arrays).
const issuesByCol: ExplorerIssue[] = WEIGHTED_ISSUE_ORDER.map((id) => {
  const k = MSCI_KEY_ISSUE_BY_ID.get(id)!;
  return { id: k.id, name: k.name, description: k.description, pillar: k.pillar };
});

const industries: ExplorerIndustry[] = MSCI_INDUSTRIES.map((ind) => ({
  gicsCode: ind.gicsCode,
  name: ind.name,
  level: ind.level,
  sectorCode: ind.sectorCode,
  weights: [...ind.weights],
  relevance: [...ind.relevance],
}));

export default async function MaterialityPage() {
  await requireAdmin();

  return (
    <div>
      <PageHeader
        title="MSCI ESG Industry Materiality Map"
        sub="MSCI's view of which ESG Key Issues are material to each GICS industry, and how much each contributes to a company's ESG Rating. Pick a sector or drill into a sub-industry to see its weighted Key Issues by pillar."
        action={<Chip tone="warn">Internal reference · proprietary</Chip>}
      />

      <MaterialityDashboard />

      <div className="mb-2 mt-8">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">Explore by industry</h2>
      </div>
      <p className="mb-4 max-w-2xl text-[13px] text-gray-600">
        The average Key Issue weight is the share an issue contributes to the overall ESG Rating for companies in the
        industry. Governance is weighted once at the pillar level (~33%); the Environmental and Social Key Issues are
        weighted individually. Bars share a fixed scale, so weights are comparable across selections.
      </p>
      <MaterialityExplorer industries={industries} issuesByCol={issuesByCol} />

      <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-gray-500">
        Source: MSCI ESG Industry Materiality Map — average Key Issue weights calculated as of {MSCI_AS_OF}. GICS® is
        jointly developed by MSCI and S&amp;P. This is proprietary MSCI reference data shown to admins for internal use
        only — not for public display or redistribution.
      </p>
    </div>
  );
}
