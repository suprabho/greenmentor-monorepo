"use client";

import { useMemo, useState } from "react";
import { clsx } from "clsx";

import type { GatedResult } from "@/lib/esg-readiness/gated";

export interface AssessmentResponse extends GatedResult {
  assessmentId: string;
}

const PERSONAL_EMAIL_DOMAINS = ["gmail.com", "yahoo.com", "outlook.com", "hotmail.com", "rediffmail.com"];

// Framework status icon glyph + colour (Doc 3 / Doc 4).
function StatusIcon({ icon }: { icon: string }) {
  const map: Record<string, { glyph: string; className: string }> = {
    filled_green: { glyph: "●", className: "text-green-700" },
    filled_amber: { glyph: "●", className: "text-warning" },
    half_grey: { glyph: "◐", className: "text-gray-500" },
    empty_grey: { glyph: "○", className: "text-gray-300" },
  };
  const s = map[icon] ?? map.empty_grey;
  return <span className={clsx("text-[15px] leading-none", s.className)}>{s.glyph}</span>;
}

const BAND_BAR: Record<string, string> = {
  red: "bg-danger",
  amber: "bg-warning",
  "yellow-green": "bg-green-500",
  green: "bg-green-700",
};

export function Results({ result }: { result: AssessmentResponse }) {
  const [form, setForm] = useState({
    name: "",
    workEmail: "",
    phone: "",
    designation: "",
    companyName: result.company.name,
  });
  const [state, setState] = useState<"idle" | "submitting" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const personalEmail = useMemo(() => {
    const domain = form.workEmail.split("@")[1]?.toLowerCase().trim();
    return !!domain && PERSONAL_EMAIL_DOMAINS.includes(domain);
  }, [form.workEmail]);

  const fillPct = Math.round((result.readiness.totalScore / result.readiness.maxScore) * 100);

  // Doc 3 edge case 1 — when nothing applies, swap bullet 5 to a soft framing.
  const bullet5 =
    result.edgeCaseFlag === "all_doesnt_apply"
      ? "Whether ESG infrastructure is worth investing in for you yet, and when"
      : "Where to start — tailored to your specific gaps";

  const canSubmit =
    form.name.trim() &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.workEmail) &&
    /^\d{10}$/.test(form.phone.replace(/\D/g, "").replace(/^91/, "")) &&
    form.companyName.trim();

  async function submit() {
    setState("submitting");
    setMessage(null);
    try {
      const res = await fetch("/api/esg-readiness/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ assessmentId: result.assessmentId, ...form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setPdfUrl(json.pdfUrl ?? null);
      setState("done");
    } catch (e) {
      setMessage(String(e instanceof Error ? e.message : e));
      setState("error");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-2">
      {/* Block 1 — header */}
      <header className="space-y-1">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-green-700">Your ESG assessment — summary</p>
        <h1 className="text-[26px] font-semibold tracking-tight text-ink">Prepared for {result.company.name}</h1>
        <p className="text-[14px] text-gray-600">
          Sector: {result.company.sectorLabel} · {result.company.subsectorLabel}
        </p>
      </header>

      {/* Block 2 — framework applicability (labels only) */}
      <section className="rounded-[12px] border border-gray-200 bg-white p-5">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-500">
          Which frameworks apply to your business
        </h2>
        <ul className="divide-y divide-gray-100">
          {result.frameworks.map((f) => (
            <li key={f.key} className="flex items-center justify-between py-2.5">
              <span className="flex items-center gap-3 text-[14px] text-ink">
                <StatusIcon icon={f.icon} />
                {f.name}
              </span>
              <span className="text-[13px] font-medium text-gray-600">{f.label}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Block 3 — readiness */}
      <section className="rounded-[12px] border border-gray-200 bg-white p-5 text-center">
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-gray-500">Your readiness</h2>
        <div className="mx-auto h-3 max-w-sm overflow-hidden rounded-full bg-gray-100">
          <div
            className={clsx("h-full rounded-full", BAND_BAR[result.readiness.bandColor] ?? "bg-green-700")}
            style={{ width: `${fillPct}%` }}
          />
        </div>
        <p className="mt-3 text-[22px] font-bold text-ink">
          {result.readiness.totalScore} / {result.readiness.maxScore}
        </p>
        <p className="mt-1 text-[16px] font-semibold text-teal-900">{result.readiness.band}</p>
        <p className="mt-0.5 text-[13.5px] text-gray-600">{result.readiness.bandTagline}</p>
      </section>

      {/* Block 4 — unlock prompt + lead capture */}
      {state === "done" ? (
        <section className="rounded-[12px] border border-green-700 bg-green-50 p-6 text-center">
          <h2 className="text-[18px] font-semibold text-ink">Your full report is on its way</h2>
          <p className="mt-2 text-[14px] text-gray-700">
            We&apos;ve emailed your detailed ESG Readiness Analysis to {form.workEmail}. It should arrive within
            10 minutes.
          </p>
          {pdfUrl && (
            <a
              href={pdfUrl}
              className="mt-4 inline-block rounded-pill bg-teal-900 px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-teal-800"
            >
              Download your report now →
            </a>
          )}
        </section>
      ) : (
        <section className="rounded-[12px] border border-gray-200 bg-white p-6">
          <h2 className="text-[16px] font-semibold text-ink">Unlock your full report</h2>
          <p className="mt-1 text-[13.5px] text-gray-600">Your detailed PDF will cover:</p>
          <ul className="mt-3 space-y-1.5 text-[13.5px] text-gray-700">
            {[
              "Why each framework applies, with confidence levels",
              "Where you stand across four areas — data, people & knowledge, governance, output & pressure",
              "Best practices for your sector at your stage",
              "How your peers benefit from being ESG-ready",
              bullet5,
            ].map((b) => (
              <li key={b} className="flex gap-2">
                <span className="text-green-700">▸</span>
                {b}
              </li>
            ))}
          </ul>

          <div className="mt-5 grid gap-3">
            <Field label="Full name" required>
              <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Work email" required>
              <input
                className={inputCls}
                type="email"
                value={form.workEmail}
                onChange={(e) => setForm({ ...form, workEmail: e.target.value })}
              />
              {personalEmail && (
                <p className="mt-1 text-[12px] text-warning">Work email helps us reach you faster.</p>
              )}
            </Field>
            <Field label="Phone (+91)" required>
              <input
                className={inputCls}
                inputMode="numeric"
                placeholder="10-digit mobile"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Designation (optional)">
              <input
                className={inputCls}
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
              />
            </Field>
            <Field label="Company name" required>
              <input
                className={inputCls}
                value={form.companyName}
                onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              />
            </Field>
          </div>

          {state === "error" && message && (
            <p className="mt-3 rounded-[6px] bg-red-50 px-3 py-2 text-[12.5px] text-danger">{message}</p>
          )}

          <button
            onClick={submit}
            disabled={!canSubmit || state === "submitting"}
            className="mt-5 w-full rounded-pill bg-green-700 px-5 py-3 text-[14px] font-semibold text-white hover:bg-green-700/90 disabled:opacity-40"
          >
            {state === "submitting" ? "Generating your report…" : "Get my full report →"}
          </button>
          <p className="mt-3 text-[11.5px] leading-relaxed text-gray-500">
            We&apos;ll send the report to your email within 10 minutes. If you do not receive your report within 24
            hours, please call us between 0900 and 2000 hrs, Monday to Saturday.
          </p>
        </section>
      )}
    </div>
  );
}

const inputCls =
  "w-full rounded-[10px] border border-gray-200 bg-white px-4 py-2.5 text-[14px] text-ink outline-none focus:border-teal-900";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12.5px] font-medium text-gray-600">
        {label}
        {required && <span className="text-danger"> *</span>}
      </span>
      {children}
    </label>
  );
}
