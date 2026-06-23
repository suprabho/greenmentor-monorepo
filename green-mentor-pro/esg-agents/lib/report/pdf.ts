import { brsrDocumentHTML } from "./render";
import type { BrsrReportModel } from "./types";

/**
 * Render the BRSR report to a paginated A4 PDF via a headless Chromium. Mirrors
 * community-engine/lib/header/screenshot.ts: serverless uses @sparticuz/chromium via
 * playwright-core; locally the full `playwright` package + its installed binary.
 * We feed the SAME HTML the in-app view renders (brsrDocumentHTML) so they match.
 */
async function launchBrowser() {
  const onServerless = !!process.env.AWS_LAMBDA_FUNCTION_VERSION || !!process.env.VERCEL_ENV;
  if (onServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    const { chromium: playwright } = await import("playwright-core");
    return playwright.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }
  const { chromium } = await import("playwright");
  return chromium.launch({ headless: true });
}

export async function renderReportPdf(model: BrsrReportModel): Promise<Buffer> {
  const html = brsrDocumentHTML(model);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => (document as Document).fonts.ready).catch(() => {});
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "20mm", left: "16mm", right: "16mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        `<div style="font-size:8px;width:100%;padding:0 16mm;color:#6b7280;display:flex;justify-content:space-between">` +
        `<span>GreenMentor — BRSR Report</span>` +
        `<span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
