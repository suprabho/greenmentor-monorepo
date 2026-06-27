import { getReportArtifacts, assembleBrsrReport, brsrDocumentHTML } from "@gm/orchestrator";
import { getEngagementContext } from "@/lib/engagement-session";

export const runtime = "nodejs";

// GET — the assembled BRSR report as a self-contained, printable HTML document
// (open in a new tab → Cmd/Ctrl-P → Save as PDF). The server-side chromium PDF
// from esg-agents (lib/report/pdf.ts) is intentionally not ported (heavy dep).
export async function GET(_req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const ctx = await getEngagementContext();
  if (!ctx) return new Response("Unauthorized", { status: 401 });
  const { engagementId } = await params;

  const artifacts = await getReportArtifacts(ctx.orgId, engagementId);
  if (!artifacts) return new Response("Engagement not found", { status: 404 });

  const model = assembleBrsrReport({ ...artifacts, generatedAt: new Date().toISOString().slice(0, 10) });
  if (model.empty) {
    return new Response("Report not ready — run the pipeline through Report Drafting first.", { status: 409 });
  }

  return new Response(brsrDocumentHTML(model), {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}
