import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { listEngagements } from "@/lib/db/engagements";
import EngagementsHome from "./EngagementsHome";

/** Authenticated home — the org's BRSR/ESG engagements. */
export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/login");

  const engagements = await listEngagements(session.orgUuid);
  return (
    <EngagementsHome
      orgName={session.orgName}
      email={session.email}
      financialYear={session.financialYear}
      engagements={engagements.map((e) => ({
        id: e.id,
        clientName: e.client_name,
        financialYear: e.financial_year,
        framework: e.framework,
        status: e.status,
      }))}
    />
  );
}
