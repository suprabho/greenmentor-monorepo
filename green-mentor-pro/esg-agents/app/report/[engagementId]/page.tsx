import { redirect, notFound } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getReportArtifacts } from "@/lib/report/repository";
import { assembleBrsrReport } from "@/lib/report/assemble";
import { brsrReportBodyHtml } from "@/lib/report/render";
import ReportToolbar from "./ReportToolbar";

export default async function ReportPage({ params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const session = await getSession();
  if (!session) redirect("/login");

  const artifacts = await getReportArtifacts(session.orgUuid, engagementId);
  if (!artifacts) notFound();

  const model = assembleBrsrReport({ ...artifacts, generatedAt: new Date().toISOString().slice(0, 10) });

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f7" }}>
      <ReportToolbar engagementId={engagementId} empty={model.empty} />
      <div style={{ maxWidth: 880, margin: "16px auto 48px", padding: 28, background: "#fff", border: "1px solid #e3e8e5", borderRadius: 14 }}>
        {model.empty ? (
          <div style={{ padding: "48px 0", textAlign: "center", color: "#5d6b64", fontSize: 14 }}>
            The BRSR report is assembled as the pipeline completes. Run through <strong>Report Drafting</strong> and{" "}
            <strong>Finalization</strong> on the board, then return here to view and download it.
          </div>
        ) : (
          <div dangerouslySetInnerHTML={{ __html: brsrReportBodyHtml(model) }} />
        )}
      </div>
    </div>
  );
}
