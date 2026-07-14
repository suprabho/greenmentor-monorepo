// Smart Upload modal: upload a bill → AI extracts fields → review the extraction
// + validation flags → apply to the form. The same file is uploaded as evidence
// in parallel so applying attaches it. Nothing is persisted here — the user
// reviews the prefilled form and submits through the normal flow.
"use client";

import { useState } from "react";
import { Sparkle, Paperclip, Warning, CheckCircle } from "@phosphor-icons/react";
import { Button } from "@/components/esg/ui";
import type { EvidenceFile } from "./EvidenceUpload";
import type { Extraction, ResolvedMasters, ValidationResult } from "@/lib/energy/extract";

export interface SmartResult {
  extracted: Extraction;
  resolved: ResolvedMasters;
  evidence: EvidenceFile | null;
}

export function SmartUpload({
  billType,
  onApply,
  onClose,
}: {
  billType: "fuel" | "electricity";
  onApply: (r: SmartResult) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ extracted: Extraction; resolved: ResolvedMasters; validation: ValidationResult; evidence: EvidenceFile | null } | null>(null);

  async function run(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const extractForm = new FormData();
      extractForm.append("file", file);
      extractForm.append("billType", billType);
      const evidenceForm = new FormData();
      evidenceForm.append("file", file);

      // Extract + stash-as-evidence run together; a failed evidence upload is
      // non-fatal (the user can still attach later).
      const [extractRes, evidenceRes] = await Promise.all([
        fetch("/api/energy/extract", { method: "POST", body: extractForm }),
        fetch("/api/energy/evidence", { method: "POST", body: evidenceForm }).catch(() => null),
      ]);
      const data = await extractRes.json();
      if (!extractRes.ok) throw new Error(data.error ?? "Extraction failed");
      let evidence: EvidenceFile | null = null;
      if (evidenceRes?.ok) {
        const ev = await evidenceRes.json();
        evidence = { path: ev.path, url: ev.url, filename: ev.filename };
      }
      setResult({ ...data, evidence });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  const ex = result?.extracted;
  const fields: [string, unknown][] = ex
    ? Object.entries(ex).filter(([, v]) => v != null && v !== "")
    : [];

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-xl bg-white p-5 shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center gap-2">
          <Sparkle size={18} weight="fill" className="text-green-600" />
          <h3 className="text-[15px] font-semibold text-ink">Smart Upload — {billType} bill</h3>
        </div>
        <p className="mb-3 text-[12.5px] text-gray-600">
          Upload a bill (PDF or image); we extract the fields and prefill the form for you to review.
        </p>

        {!result && (
          <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-gray-50 px-3 py-6 text-[13px] text-gray-600 hover:border-teal-700 hover:text-ink">
            <Paperclip size={15} />
            {busy ? "Extracting… this can take a few seconds" : "Choose a bill to extract"}
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              disabled={busy}
              onChange={(e) => e.target.files?.[0] && run(e.target.files[0])}
            />
          </label>
        )}
        {error && <p className="mt-2 text-[12.5px] font-medium text-danger">{error}</p>}

        {result && (
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 p-3">
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-500">Extracted</div>
              {fields.length === 0 ? (
                <p className="text-[12.5px] text-gray-500">No fields detected — try a clearer scan.</p>
              ) : (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12.5px]">
                  {fields.map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt className="text-gray-500">{k.replace(/_/g, " ")}</dt>
                      <dd className="font-medium text-ink">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            {(result.validation.flags.length > 0 || result.resolved.notes.length > 0) && (
              <ul className="space-y-1">
                {result.validation.flags.map((f) => (
                  <li key={f.rule} className={"flex items-center gap-1.5 text-[12px] " + (f.severity === "hard" ? "text-danger" : "text-[#B25E00]")}>
                    <Warning size={13} weight="fill" /> {f.label}
                  </li>
                ))}
                {result.resolved.notes.map((n) => (
                  <li key={n} className="flex items-center gap-1.5 text-[12px] text-gray-500">
                    <Warning size={13} /> {n}
                  </li>
                ))}
              </ul>
            )}
            {result.validation.status === "passed" && result.resolved.notes.length === 0 && (
              <p className="flex items-center gap-1.5 text-[12px] text-green-700">
                <CheckCircle size={14} weight="fill" /> Looks clean — review and submit.
              </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setResult(null)}>Try another</Button>
              <Button
                onClick={() => onApply({ extracted: result.extracted, resolved: result.resolved, evidence: result.evidence })}
                disabled={result.validation.status === "failed"}
                title={result.validation.status === "failed" ? "Fix the flagged issues on the source bill first" : undefined}
              >
                Apply to form
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
