import { redirect } from "next/navigation";
import { getEngagementContext } from "@/lib/engagement-session";
import {
  getFugitiveMasters,
  listFugitiveEntries,
  listSites,
  getMemberRole,
  isChecker,
} from "@/lib/energy/repo";
import { FugitiveClient } from "@/components/energy/FugitiveClient";

export const dynamic = "force-dynamic";

export default async function FugitivePage() {
  const ctx = await getEngagementContext();
  if (!ctx) redirect("/login?next=/energy/fugitive");
  const [masters, sites, entries, role] = await Promise.all([
    getFugitiveMasters(),
    listSites(ctx.orgId),
    listFugitiveEntries(ctx.orgId),
    getMemberRole(ctx.orgId, ctx.userId),
  ]);
  return (
    <FugitiveClient masters={masters} initialSites={sites} initialEntries={entries} canReview={isChecker(role)} />
  );
}
