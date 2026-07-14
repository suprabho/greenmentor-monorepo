// Transactional email via Resend — the one piece of infrastructure the no-code
// stack (Brevo) was buying that did not already exist in-repo. Everything is
// gated on RESEND_API_KEY: when unset (local dev), sends are logged and skipped
// so the assessment flow still completes and returns the PDF download URL.
//
// Env:
//   RESEND_API_KEY    — enables sending
//   ESG_FROM_EMAIL    — verified sender (default sustainability@greenmentor.co)
//   ESG_LEAD_INBOX    — internal lead-alert recipient (default = from)

import { Resend } from "resend";

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  return key ? new Resend(key) : null;
}

const FROM = () => process.env.ESG_FROM_EMAIL || "sustainability@greenmentor.co";
const LEAD_INBOX = () => process.env.ESG_LEAD_INBOX || FROM();

export interface SendResult {
  sent: boolean;
  skipped?: boolean;
  error?: string;
}

async function send(args: {
  to: string;
  subject: string;
  html: string;
  attachment?: { filename: string; content: Buffer };
}): Promise<SendResult> {
  const resend = client();
  if (!resend) {
    console.info(`[email] RESEND_API_KEY unset — skipping "${args.subject}" → ${args.to}`);
    return { sent: false, skipped: true };
  }
  try {
    const { error } = await resend.emails.send({
      from: FROM(),
      to: args.to,
      subject: args.subject,
      html: args.html,
      attachments: args.attachment
        ? [{ filename: args.attachment.filename, content: args.attachment.content }]
        : undefined,
    });
    if (error) return { sent: false, error: String(error) };
    return { sent: true };
  } catch (e) {
    return { sent: false, error: String(e instanceof Error ? e.message : e) };
  }
}

/** PDF delivery email to the lead (Doc 5 stage 14), with the report attached. */
export function sendReportEmail(args: {
  to: string;
  companyName: string;
  pdf: Buffer;
  pdfUrl: string;
}): Promise<SendResult> {
  const html = `
    <p>Please find attached your ESG Readiness Analysis, generated based on the responses you provided.</p>
    <p>The report covers which frameworks apply to your business, where you currently stand, what your peers in your
    sector are doing, and where to start.</p>
    <p>You can also <a href="${args.pdfUrl}">download it here</a>.</p>
    <p>Questions? Reach us between 0900 and 2000 hrs, Monday to Saturday, or reply to this email — we'll be in touch
    within 3 business days either way.</p>
    <p>— Team GreenMentor</p>`;
  return send({
    to: args.to,
    subject: "Your ESG Readiness Analysis",
    html,
    attachment: { filename: `GreenMentor_ESG_Report_${args.companyName.replace(/\s+/g, "_")}.pdf`, content: args.pdf },
  });
}

/** Internal lead alert with full context (Doc 5 stage 15). */
export function sendLeadAlert(args: {
  name: string;
  email: string;
  phone: string;
  designation?: string | null;
  companyName: string;
  sector: string;
  turnover: string;
  band: string;
  topFrameworks: string[];
  source?: string | null;
  pdfUrl: string;
}): Promise<SendResult> {
  const html = `
    <h3>New ESG Readiness lead — ${args.band}</h3>
    <ul>
      <li><b>${args.name}</b>${args.designation ? `, ${args.designation}` : ""} · ${args.companyName}</li>
      <li>${args.email} · ${args.phone}</li>
      <li>Sector: ${args.sector} · Turnover: ${args.turnover}</li>
      <li>Readiness band: <b>${args.band}</b></li>
      <li>Top applicable frameworks: ${args.topFrameworks.join(", ") || "—"}</li>
      <li>Source: ${args.source || "direct"}</li>
      <li><a href="${args.pdfUrl}">Report PDF</a></li>
    </ul>`;
  return send({
    to: LEAD_INBOX(),
    subject: `Lead from ${args.source || "direct"} — ${args.band}, ${args.topFrameworks[0] ?? "ESG"}`,
    html,
  });
}
