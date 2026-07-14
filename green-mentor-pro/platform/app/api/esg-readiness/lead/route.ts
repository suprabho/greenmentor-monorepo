import { NextResponse } from "next/server";
import { z } from "zod";

import { createAdminClient } from "@/lib/supabase/admin";
import { assess } from "@/lib/esg-readiness";
import { answersSchema } from "@/lib/esg-readiness/schema";
import { fetchContent } from "@/lib/esg-readiness/content";
import { buildReportModel } from "@/lib/esg-readiness/payload";
import { renderReadinessPdf } from "@/lib/esg-readiness/pdf";
import { SECTORS, TURNOVER_BANDS } from "@/lib/esg-readiness/questions";
import { sendLeadAlert, sendReportEmail } from "@/lib/email";

export const runtime = "nodejs";
export const maxDuration = 300; // Playwright render can take up to ~2 min (mirrors esg-agents PDF route)

const leadSchema = z.object({
  assessmentId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  workEmail: z.string().trim().email(),
  phone: z.string().trim().min(6).max(20),
  designation: z.string().trim().max(200).optional().nullable(),
  companyName: z.string().trim().min(1).max(200),
});

const STORAGE_BUCKET = "esg-reports";
const SIGNED_URL_TTL = 60 * 60 * 24 * 30; // 30 days

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

/** date + 3 business days, for the sales callback SLA (Doc 5 stage 16). */
function callbackDue(from: Date): string {
  const d = new Date(from);
  let added = 0;
  while (added < 3) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }
  const parsed = leadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid lead", issues: parsed.error.flatten() }, { status: 422 });
  }
  const lead = parsed.data;

  const supabase = createAdminClient();

  // Load the assessment; re-run the engine from the stored answers so the PDF
  // uses the full readiness detail deterministically (no need to persist it all).
  const { data: row, error: fetchErr } = await supabase
    .from("esg_assessments")
    .select("id, answers, source_utm")
    .eq("id", lead.assessmentId)
    .single();
  if (fetchErr || !row) {
    return NextResponse.json({ error: "assessment not found" }, { status: 404 });
  }

  const answers = answersSchema.parse(row.answers);
  const result = assess(answers);

  // Content lookup (graceful degradation → always populated).
  const content = await fetchContent(supabase, {
    sector: answers.q1_sector,
    turnover: answers.q3_turnover,
    readiness: result.readiness,
    frameworks: result.frameworks,
  });

  const now = new Date();
  const model = buildReportModel(result, answers, content, formatDate(now));
  const pdf = await renderReadinessPdf(model);

  // Store the PDF and mint a signed download URL.
  const path = `${lead.assessmentId}.pdf`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    return NextResponse.json({ error: `pdf storage failed: ${upErr.message}` }, { status: 500 });
  }
  const { data: signed } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
  const pdfUrl = signed?.signedUrl ?? "";

  // Persist lead details + delivery state (RLS bypassed via service role).
  await supabase
    .from("esg_assessments")
    .update({
      lead_name: lead.name,
      work_email: lead.workEmail,
      phone: lead.phone,
      designation: lead.designation ?? null,
      company_name: lead.companyName,
      pdf_url: pdfUrl,
      status: "new",
      callback_due: callbackDue(now),
    })
    .eq("id", lead.assessmentId);

  // Emails are best-effort — a skipped/failed send must not fail the request or
  // block the on-screen download (Doc 5 failure 6).
  const sectorLabel = SECTORS.find((s) => s.code === answers.q1_sector)?.label ?? answers.q1_sector;
  const turnoverLabel = TURNOVER_BANDS.find((b) => b.code === answers.q3_turnover)?.label ?? answers.q3_turnover;
  const topFrameworks = result.frameworks
    .filter((f) => f.label === "Definite" || f.label === "Likely")
    .map((f) => f.name)
    .slice(0, 3);

  await Promise.allSettled([
    sendReportEmail({ to: lead.workEmail, companyName: lead.companyName, pdf, pdfUrl }),
    sendLeadAlert({
      name: lead.name,
      email: lead.workEmail,
      phone: lead.phone,
      designation: lead.designation,
      companyName: lead.companyName,
      sector: sectorLabel,
      turnover: turnoverLabel,
      band: result.readiness.band,
      topFrameworks,
      source: row.source_utm,
      pdfUrl,
    }),
  ]);

  return NextResponse.json({ ok: true, pdfUrl });
}
