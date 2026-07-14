// Shared server-side loader for the Energy pages: resolves the signed-in user's
// org context and the data the entry screens need. Uses the same repo (admin
// client) as the write routes so reads and writes see an identical view.
import { redirect } from "next/navigation";
import { getEngagementContext } from "@/lib/engagement-session";
import { getMasters, listSites, getMemberRole, isChecker } from "@/lib/energy/repo";
import type { EnergyMasters, EnergySite } from "@/lib/energy/types";

export interface EnergyPageContext {
  orgId: string;
  masters: EnergyMasters;
  sites: EnergySite[];
  canReview: boolean;
}

export async function loadEnergyContext(next: string): Promise<EnergyPageContext> {
  const ctx = await getEngagementContext();
  if (!ctx) redirect(`/login?next=${encodeURIComponent(next)}`);
  const [masters, sites, role] = await Promise.all([
    getMasters(),
    listSites(ctx.orgId),
    getMemberRole(ctx.orgId, ctx.userId),
  ]);
  return { orgId: ctx.orgId, masters, sites, canReview: isChecker(role) };
}
