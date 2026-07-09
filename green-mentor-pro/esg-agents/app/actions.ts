"use server";

import { redirect } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth/session";
import { umLogout } from "@/lib/auth/um";
import { createEngagement } from "@/lib/db/engagements";

/** Create a new engagement for the signed-in org and open its board. */
export async function createEngagementAction(formData: FormData): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/login");

  const clientName = String(formData.get("client_name") || session.orgName).trim() || session.orgName;
  const financialYear = String(formData.get("financial_year") || session.financialYear).trim() || session.financialYear;
  const frameworks = String(formData.get("frameworks") || "BRSR")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const eng = await createEngagement(session.orgUuid, {
    clientName,
    financialYear,
    framework: frameworks.length ? frameworks : ["BRSR"],
    // Harness engagements are explicitly demo-data-backed (the @gm/orchestrator copy
    // used by the platform treats demo as opt-in, so keep this explicit here).
    config: { mode: "live", data_source_mode: "demo" },
    createdBy: session.userUuid,
  });
  redirect(`/engagements/${eng.id}`);
}

export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) await umLogout(session.accessToken);
  await clearSession();
  redirect("/login");
}
