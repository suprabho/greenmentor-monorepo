// Render the ESG Readiness report to a 2-page A4 PDF via headless Chromium.
// Mirrors esg-agents/lib/report/pdf.ts: serverless (Vercel/Lambda) uses
// @sparticuz/chromium + playwright-core; locally the full `playwright` package
// with its installed browser binary. Same HTML the (future) in-app preview would
// use, so they stay in sync.

import { reportHTML } from "./report-html";
import type { ReportModel } from "./payload";

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

export async function renderReadinessPdf(model: ReportModel): Promise<Buffer> {
  const html = reportHTML(model);
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle", timeout: 60_000 });
    await page.evaluate(() => (document as Document).fonts.ready).catch(() => {});
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "18mm", bottom: "18mm", left: "20mm", right: "20mm" },
      displayHeaderFooter: true,
      headerTemplate: "<span></span>",
      footerTemplate:
        `<div style="font-size:8px;width:100%;padding:0 20mm;color:#878787;display:flex;justify-content:flex-end">` +
        `<span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span></div>`,
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
