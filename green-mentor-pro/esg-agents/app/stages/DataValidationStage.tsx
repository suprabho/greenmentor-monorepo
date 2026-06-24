"use client";

import { C } from "./theme";
import { Card, Chip, Accordion, Table, Badge, StatusBadge, ConfidenceBadge, Gauge, BarChart, Bullets, toneColor, fmt, Empty, arr } from "./primitives";
import type { ValidationArtifact, ValidationIssue } from "./types";

const VERDICT: Record<string, { bg: string; fg: string; label: string }> = {
  pass: { bg: "#e6f4ec", fg: C.high, label: "✓ Pass" },
  pass_with_warnings: { bg: "#fbf2dc", fg: C.medium, label: "▲ Pass with warnings" },
  fail: { bg: "#fde8de", fg: C.low, label: "✕ Fail" },
};
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

export default function DataValidationStage({ o }: { o: Record<string, unknown> }) {
  const a = o as ValidationArtifact;
  const checks = arr<NonNullable<ValidationArtifact["check_results"]>[number]>(a.check_results);
  const issues = arr<ValidationIssue>(a.issues);
  const yoy = arr<NonNullable<ValidationArtifact["yoy_summary"]>[number]>(a.yoy_summary);
  const gaps = arr<{ metric_code?: string; site_id?: string | null; reason?: string }>(a.gaps);
  const queue = arr<{ issue_id?: string; why?: string }>(a.human_queue);
  const queries = arr<{ issue_id?: string; data_owner?: string; question?: string }>(a.data_owner_queries);

  const v = VERDICT[a.verdict ?? ""] ?? { bg: "#eef1f0", fg: C.sub, label: a.verdict ?? "—" };
  const checkTally = (["pass", "warn", "fail", "not_applicable"] as const)
    .map((st) => ({ label: st.replace("_", " "), value: checks.filter((c) => c.status === st).length, color: toneColor(st) }))
    .filter((d) => d.value > 0);

  const severitiesPresent = SEVERITY_ORDER.filter((s) => issues.some((i) => i.severity === s));

  return (
    <div>
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ background: v.bg, color: v.fg, borderRadius: 10, padding: "12px 18px", fontWeight: 750, fontSize: 18 }}>{v.label}</div>
          <div style={{ textAlign: "center" }}>
            <Gauge value={typeof a.data_quality_score === "number" ? a.data_quality_score : null} label="quality score" />
          </div>
        </div>
      </Card>

      <Card title={`Checks · ${checks.length}`}>
        {!!checkTally.length && (
          <div style={{ marginBottom: 12 }}>
            <BarChart data={checkTally} valueFmt={(n) => String(n)} />
          </div>
        )}
        <Table
          rows={checks}
          emptyText="No checks."
          columns={[
            { key: "check", header: "Check", render: (r) => <strong>{r.check ?? "—"}</strong>, sortValue: (r) => r.check ?? "" },
            { key: "scope", header: "Scope", render: (r) => <span style={{ color: C.sub }}>{r.scope ?? "—"}</span> },
            { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} />, sortValue: (r) => r.status ?? "" },
            { key: "detail", header: "Detail", render: (r) => <span style={{ color: C.sub }}>{r.detail ?? "—"}</span> },
          ]}
        />
      </Card>

      {!!issues.length && (
        <Card title={`Issues · ${issues.length}`}>
          <Accordion
            items={severitiesPresent.map((sev) => {
              const rows = issues.filter((i) => i.severity === sev);
              return {
                key: sev,
                defaultOpen: sev === "critical" || sev === "high",
                title: <Badge label={`${sev} · ${rows.length}`} bg="#fff" fg={toneColor(sev)} />,
                children: (
                  <div style={{ paddingTop: 10, display: "grid", gap: 10 }}>
                    {rows.map((it, i) => (
                      <div key={it.issue_id ?? i} style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${toneColor(sev)}`, borderRadius: 8, padding: 11 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <Chip>{it.check ?? "—"}</Chip>
                            <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5, color: "#8a958f" }}>{it.metric_code ?? ""}</span>
                          </span>
                          <ConfidenceBadge level={it.confidence} />
                        </div>
                        <div style={{ fontSize: 13, color: C.text, margin: "6px 0", lineHeight: 1.5 }}>{it.finding ?? "—"}</div>
                        {it.suggested_fix && (
                          <div style={{ fontSize: 12.5, color: C.high, background: "#e6f4ec", padding: "6px 9px", borderRadius: 6 }}>
                            <strong>Fix:</strong> {it.suggested_fix}
                          </div>
                        )}
                        {it.route_to_human && <div style={{ fontSize: 11.5, color: C.low, marginTop: 5, fontWeight: 600 }}>● routed to human review</div>}
                      </div>
                    ))}
                  </div>
                ),
              };
            })}
          />
        </Card>
      )}

      {!!yoy.length && (
        <Card title="Year-over-year">
          <Table
            rows={yoy}
            rowStyle={(r) => (r.flagged ? { background: "#fef6f2" } : undefined)}
            columns={[
              { key: "metric_code", header: "Metric", render: (r) => <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 11.5 }}>{r.metric_code ?? "—"}</span> },
              { key: "site_id", header: "Site", render: (r) => r.site_id ?? "—" },
              { key: "current", header: "Current", align: "right", render: (r) => fmt(r.current) },
              { key: "prior", header: "Prior", align: "right", render: (r) => fmt(r.prior) },
              { key: "yoy", header: "Δ %", align: "right", render: (r) => (r.yoy_change_pct == null ? "—" : `${r.yoy_change_pct > 0 ? "+" : ""}${fmt(r.yoy_change_pct)}%`) },
              { key: "flagged", header: "", render: (r) => (r.flagged ? <span style={{ color: C.low }}>⚑</span> : "") },
            ]}
          />
        </Card>
      )}

      <ListCard title="Gaps" rows={gaps.map((g) => `${g.metric_code ?? "—"}${g.site_id ? ` (${g.site_id})` : ""} — ${g.reason ?? ""}`)} />
      <ListCard title="Routed to human" rows={queue.map((q) => `${q.issue_id ?? "—"} — ${q.why ?? ""}`)} />
      <ListCard title="Data-owner queries" rows={queries.map((q) => `${q.data_owner ?? "—"}: ${q.question ?? ""}`)} />
      {!!arr(a.assumptions).length && (
        <Card title="Assumptions">
          <Bullets items={a.assumptions ?? []} />
        </Card>
      )}
      {!!arr(a.limitations).length && (
        <Card title="Limitations">
          <Bullets items={a.limitations ?? []} />
        </Card>
      )}

      {!checks.length && !issues.length && <Empty>No validation results.</Empty>}
    </div>
  );
}

function ListCard({ title, rows }: { title: string; rows: string[] }) {
  if (!rows.length) return null;
  return (
    <Card title={`${title} · ${rows.length}`}>
      <div style={{ display: "grid", gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ fontSize: 12.5, color: C.text, borderBottom: `1px solid ${C.border}`, paddingBottom: 5 }}>
            {r}
          </div>
        ))}
      </div>
    </Card>
  );
}
