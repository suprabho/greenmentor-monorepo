"use client";

import { C, ACCENT } from "./theme";
import { Card, SectionLabel, Chip, Accordion, Table, StatusBadge, ConfidenceBadge, StackedBar, BarChart, Bullets, fmt, Empty, arr } from "./primitives";
import type { CalculationArtifact, EmissionResult, Kpi, DisclosureMapping } from "./types";

function KpiCard({ k }: { k: Kpi }) {
  const yoy = k.yoy_change_pct;
  const down = typeof yoy === "number" && yoy < 0;
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 13, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.4 }}>{k.label ?? k.kpi_code ?? "—"}</div>
      <div style={{ fontSize: 22, fontWeight: 750, margin: "4px 0 2px" }}>
        {fmt(k.value)} <span style={{ fontSize: 13, color: C.sub, fontWeight: 600 }}>{k.unit ?? ""}</span>
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {typeof yoy === "number" && (
          <span style={{ fontSize: 11.5, fontWeight: 700, color: down ? C.high : C.low }}>
            {down ? "▼" : "▲"} {fmt(Math.abs(yoy))}% YoY
          </span>
        )}
        {k.target_status && <StatusBadge value={k.target_status === "on_track" || k.target_status === "achieved" ? "pass" : "warn"} label={k.target_status.replace("_", " ")} />}
        {k.benchmark_position && <Chip>{k.benchmark_position.replace("_", " ")}</Chip>}
      </div>
      {k.provenance?.formula && <div style={{ fontSize: 11, color: "#8a958f", marginTop: 6, fontFamily: "ui-monospace, Menlo, monospace", lineHeight: 1.4 }}>{k.provenance.formula}</div>}
    </div>
  );
}

export default function CalculationStage({ o }: { o: Record<string, unknown> }) {
  const a = o as CalculationArtifact;
  const emissions = arr<EmissionResult>(a.emission_results);
  const kpis = arr<Kpi>(a.kpis);
  const mappings = arr<DisclosureMapping>(a.disclosure_mappings);
  const st = a.scope_totals ?? {};
  const queue = arr<{ row_ref?: string; reason?: string }>(a.human_queue);

  const unresolved = emissions.length > 0 && emissions.every((e) => e.status === "unresolved" || e.total_co2e_kg == null);

  const scopeSegs = [
    { label: "Scope 1", value: st.scope1_co2e_kg, color: "#1f8a5b" },
    { label: "Scope 2 (location)", value: st.scope2_location_co2e_kg, color: "#3a9b73" },
    { label: "Scope 2 (market)", value: st.scope2_market_co2e_kg, color: "#5db38f" },
    { label: "Scope 3", value: st.scope3_co2e_kg, color: "#b8860b" },
  ];

  const bySite = new Map<string, number>();
  for (const e of emissions) {
    if (typeof e.total_co2e_kg === "number" && Number.isFinite(e.total_co2e_kg)) bySite.set(e.site_id ?? "—", (bySite.get(e.site_id ?? "—") ?? 0) + e.total_co2e_kg);
  }
  const siteBars = [...bySite.entries()].map(([label, value]) => ({ label, value }));

  const frameworks = [...new Set(mappings.map((m) => m.framework ?? "—"))];

  return (
    <div>
      <Card
        title="Calculation & ESG metrics"
        accent={ACCENT}
        right={a.run_confidence ? <ConfidenceBadge level={a.run_confidence} /> : undefined}
      >
        {unresolved && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: C.medium, background: "#fbf2dc", padding: "8px 11px", borderRadius: 8, marginBottom: 12 }}>
            ▲ Emission factors not resolved — CO₂e totals are pending and routed to human review.
          </div>
        )}
        <SectionLabel>Scope totals (kg CO₂e)</SectionLabel>
        <StackedBar segments={scopeSegs} emptyText="Scope totals not yet computed (emission factors pending)." />
      </Card>

      {!!kpis.length && (
        <Card title={`KPIs · ${kpis.length}`}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
            {kpis.map((k, i) => (
              <KpiCard key={k.kpi_code ?? i} k={k} />
            ))}
          </div>
        </Card>
      )}

      <Card title="Emissions by site (kg CO₂e)">
        <BarChart data={siteBars} emptyText="No computed emissions yet." />
      </Card>

      {!!emissions.length && (
        <Card title={`Emission results · ${emissions.length}`}>
          <Table
            rows={emissions}
            columns={[
              { key: "metric_code", header: "Metric", render: (r) => <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>{r.metric_code ?? "—"}</span> },
              { key: "site_id", header: "Site", render: (r) => r.site_id ?? "—" },
              { key: "ghg_scope", header: "Scope", align: "center", render: (r) => r.ghg_scope ?? "—" },
              { key: "quantity", header: "Qty", align: "right", render: (r) => `${fmt(r.quantity)} ${r.unit ?? ""}` },
              { key: "total_co2e_kg", header: "kg CO₂e", align: "right", render: (r) => fmt(r.total_co2e_kg), sortValue: (r) => r.total_co2e_kg ?? -1 },
              { key: "calc_confidence", header: "Conf", render: (r) => <ConfidenceBadge level={r.calc_confidence} /> },
              { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
            ]}
          />
        </Card>
      )}

      {!!mappings.length && (
        <Card title={`Disclosure mappings · ${mappings.length}`}>
          <Accordion
            items={frameworks.map((fw) => {
              const rows = mappings.filter((m) => (m.framework ?? "—") === fw);
              const resolved = rows.filter((m) => m.status === "mapped").length;
              return {
                key: fw,
                title: <strong>{fw}</strong>,
                right: (
                  <Chip>
                    {resolved}/{rows.length} mapped
                  </Chip>
                ),
                children: (
                  <div style={{ paddingTop: 8 }}>
                    <Table
                      rows={rows}
                      columns={[
                        { key: "disclosure_code", header: "Code", render: (r) => <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>{r.disclosure_code ?? "—"}</span> },
                        { key: "answer", header: "Answer", render: (r) => <span>{r.answer == null ? "—" : String(r.answer)}{r.unit ? ` ${r.unit}` : ""}</span> },
                        { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
                      ]}
                    />
                  </div>
                ),
              };
            })}
          />
        </Card>
      )}

      {!!arr(a.trends).length && (
        <Card title="Trends">
          <Bullets items={a.trends ?? []} />
        </Card>
      )}
      {!!arr(a.risks_opportunities).length && (
        <Card title="Risks & opportunities">
          <Bullets items={a.risks_opportunities ?? []} />
        </Card>
      )}
      {!!queue.length && (
        <Card title={`Needs review · ${queue.length}`} accent={C.medium}>
          {queue.map((q, i) => (
            <div key={i} style={{ fontSize: 12.5, color: C.text, marginBottom: 5 }}>
              <span style={{ fontFamily: "ui-monospace, Menlo, monospace", color: "#8a958f" }}>{q.row_ref ?? "—"}</span> — {q.reason ?? ""}
            </div>
          ))}
        </Card>
      )}

      {!emissions.length && !kpis.length && !mappings.length && <Empty>No calculation results.</Empty>}
    </div>
  );
}
