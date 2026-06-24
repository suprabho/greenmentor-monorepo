import { getSession } from "@/lib/auth/session";
import { getReportArtifacts } from "@/lib/report/repository";
import { assembleBrsrReport } from "@/lib/report/assemble";
import { renderReportPdf } from "@/lib/report/pdf";

export const runtime = "nodejs"; // Playwright needs Node; node:crypto for session
export const maxDuration = 300; // a long BRSR doc can take a while to paginate

export async function GET(_req: Request, { params }: { params: Promise<{ engagementId: string }> }) {
  const { engagementId } = await params;
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const artifacts = await getReportArtifacts(session.orgUuid, engagementId);
  if (!artifacts) return new Response("Engagement not found", { status: 404 });

  const model = assembleBrsrReport({ ...artifacts, generatedAt: new Date().toISOString().slice(0, 10) });
  if (model.empty) return new Response("Report not ready — complete the pipeline first.", { status: 409 });

  try {
    const buf = await renderReportPdf(model);
    const fname = `BRSR-${model.meta.clientName.replace(/[^a-z0-9]+/gi, "-")}-${model.meta.financialYear}.pdf`;
    return new Response(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fname}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "render failed";
    const hint = /Executable doesn't exist|launch/i.test(msg)
      ? " — run `npx playwright install chromium` in green-mentor-pro/esg-agents."
      : "";
    return new Response(`PDF export failed: ${msg}${hint}`, { status: 500 });
  }
}
