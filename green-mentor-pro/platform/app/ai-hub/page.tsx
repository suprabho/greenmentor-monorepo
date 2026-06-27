"use client";

import { useState } from "react";
import { Card, Chip, PageHeader } from "@/components/ui";

type Family = "planning" | "document-extraction" | "reports-producer";

const FAMILIES: { id: Family; label: string; agent: string; note: string }[] = [
  { id: "planning", label: "Planning Agents", agent: "kickoff-scoping", note: "Sonnet · scope plan" },
  { id: "document-extraction", label: "Document Extraction", agent: "data-collection", note: "Opus · extract dataset" },
  { id: "reports-producer", label: "Reports Producer", agent: "report-drafting", note: "Sonnet · report draft" },
];

const SAMPLES: Record<Family, unknown> = {
  planning: {
    tenant_id: "org_demo",
    engagement_id: "eng_demo",
    client: { name: "Acme Manufacturing Ltd", sector: "Manufacturing", country: "India", employees: 1200, listed: true },
    candidate_frameworks: ["BRSR", "GRI", "CSRD"],
    reporting_period: { financial_year: "FY2025-26", start: "2025-04-01", end: "2026-03-31" },
    sites: [{ site_id: "site_pune", name: "Pune Plant", country: "India" }],
    brief: "First-time BRSR Core filing for an Indian listed manufacturer; assess frameworks and draft a scoping plan.",
  },
  "document-extraction": {
    tenant_id: "org_demo",
    engagement_id: "eng_demo",
    financial_year: "FY2025-26",
    field_catalog: [{ field_id: "grid_electricity_kwh", label: "Grid electricity (kWh)", unit: "kWh", type: "number" }],
    data_request_list: [{ request_id: "req_grid_elec", site_id: "site_pune", period_label: "FY2025-26", fields: ["grid_electricity_kwh"] }],
    submissions: [{ request_id: "req_grid_elec", site_id: "site_pune", form_values: { grid_electricity_kwh: 184200, reporting_basis: "billed" } }],
  },
  "reports-producer": {
    tenant_id: "org_demo",
    engagement_id: "eng_demo",
    frameworks_in_scope: ["BRSR"],
    calc_result: {
      scope1_tco2e: 1280,
      scope2_tco2e: 940,
      scope3_tco2e: 5120,
      energy_mwh: 184.2,
      methodology: "GHG Protocol; grid emission factor CEA v19.",
    },
  },
};

export default function AiHub() {
  const [family, setFamily] = useState<Family>("planning");
  const [input, setInput] = useState(() => JSON.stringify(SAMPLES.planning, null, 2));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ meta?: unknown; output?: unknown } | null>(null);

  function pickFamily(f: Family) {
    setFamily(f);
    setInput(JSON.stringify(SAMPLES[f], null, 2));
    setResult(null);
    setError(null);
  }

  async function run() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsed = JSON.parse(input);
      const res = await fetch("/api/ai-hub/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ family, input: parsed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setResult(json);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="AI Hub" sub="Run an ESG agent (esg-agents runtime via @gm/agents) and review its output" />

      <div className="flex flex-wrap gap-2">
        {FAMILIES.map((f) => (
          <button
            key={f.id}
            onClick={() => pickFamily(f.id)}
            className={
              "rounded-pill border px-3.5 py-1.5 text-[13px] font-medium transition-colors " +
              (family === f.id
                ? "border-teal-900 bg-teal-900 text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-gray-300")
            }
          >
            {f.label}
            <span className="ml-2 text-[11px] opacity-70">{f.note}</span>
          </button>
        ))}
      </div>

      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <Chip tone="green">input</Chip>
          <button
            onClick={run}
            disabled={loading}
            className="rounded-pill bg-green-700 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-green-700/90 disabled:opacity-50"
          >
            {loading ? "Running…" : "Run agent"}
          </button>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          spellCheck={false}
          className="h-72 w-full rounded-xl border border-gray-200 bg-gray-50 p-3 font-mono text-[12px] leading-relaxed text-gray-800 outline-none focus:border-teal-700"
        />
      </Card>

      {error && (
        <Card className="border-red-200 bg-red-50 p-4 text-[13px] text-danger">
          <span className="font-semibold">Error:</span> {error}
        </Card>
      )}

      {result && (
        <Card className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Chip tone="teal">output</Chip>
            {typeof result.meta === "object" && result.meta !== null && "model" in result.meta ? (
              <span className="text-[12px] text-gray-600">{String((result.meta as { model: string }).model)}</span>
            ) : null}
          </div>
          <pre className="max-h-[28rem] overflow-auto rounded-xl bg-ink p-4 font-mono text-[12px] leading-relaxed text-green-100">
            {JSON.stringify(result.output, null, 2)}
          </pre>
        </Card>
      )}
    </div>
  );
}
