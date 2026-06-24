"use client";

import { C, ACCENT } from "./theme";
import { Card, SectionLabel, Accordion, Table, StatusBadge, ProgressBar, MarkdownBlock, Bullets, safeText, Empty, arr } from "./primitives";
import type { PublicationArtifact } from "./types";

export default function PublicationStage({ o }: { o: Record<string, unknown> }) {
  const a = o as PublicationArtifact;
  const summary = a.investor_summary ?? {};
  const metrics = arr<NonNullable<NonNullable<PublicationArtifact["investor_summary"]>["headline_metrics"]>[number]>(summary.headline_metrics);
  const highlights = arr<string>(summary.highlights);
  const checklist = arr<{ item?: string; done?: boolean }>(a.publication_checklist);
  const issues = arr<{ where?: string; finding?: string; severity?: string }>(a.consistency_issues);
  const sections = arr<{ section_id?: string; title?: string; body_markdown?: string }>(a.final_sections);

  const done = checklist.filter((c) => c.done).length;

  return (
    <div>
      {(metrics.length || highlights.length) > 0 && (
        <Card title="Investor summary" accent={ACCENT}>
          {!!metrics.length && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10, marginBottom: highlights.length ? 14 : 0 }}>
              {metrics.map((m, i) => (
                <div key={i} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 11.5, color: C.sub, lineHeight: 1.35 }}>{m.label ?? "—"}</div>
                  <div style={{ fontSize: 20, fontWeight: 750, margin: "3px 0 1px" }}>
                    {safeText(m.value)} <span style={{ fontSize: 12, color: C.sub, fontWeight: 600 }}>{m.unit ?? ""}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.sub }}>
                    {m.period ?? ""}
                    {m.yoy_change ? ` · ${m.yoy_change}` : ""}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!!highlights.length && (
            <>
              <SectionLabel>Highlights</SectionLabel>
              <Bullets items={highlights} check />
            </>
          )}
        </Card>
      )}

      {!!checklist.length && (
        <Card title="Publication checklist" right={`${done}/${checklist.length}`}>
          <div style={{ marginBottom: 12 }}>
            <ProgressBar value={done} max={checklist.length} />
          </div>
          <div style={{ display: "grid", gap: 5 }}>
            {checklist.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 9, fontSize: 13, color: c.done ? C.text : C.sub }}>
                <span style={{ color: c.done ? ACCENT : C.blocked, fontWeight: 700 }}>{c.done ? "✓" : "○"}</span>
                {c.item ?? "—"}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!!issues.length && (
        <Card title={`Consistency issues · ${issues.length}`}>
          <Table
            rows={issues}
            rowStyle={(r) => (r.severity === "error" ? { background: "#fef6f2" } : undefined)}
            columns={[
              { key: "where", header: "Where", render: (r) => <strong>{r.where ?? "—"}</strong> },
              { key: "finding", header: "Finding", render: (r) => <span style={{ color: C.sub }}>{r.finding ?? "—"}</span> },
              { key: "severity", header: "Severity", render: (r) => <StatusBadge value={r.severity} />, sortValue: (r) => r.severity ?? "" },
            ]}
          />
        </Card>
      )}

      {!!sections.length && (
        <Card title={`Final sections · ${sections.length}`}>
          <Accordion
            items={sections.map((s, i) => ({
              key: s.section_id ?? String(i),
              defaultOpen: i === 0,
              title: <strong>{s.title ?? s.section_id ?? "Section"}</strong>,
              children: (
                <div style={{ paddingTop: 10 }}>
                  <MarkdownBlock md={s.body_markdown} />
                </div>
              ),
            }))}
          />
        </Card>
      )}

      {!metrics.length && !checklist.length && !sections.length && <Empty>No publication artifact yet.</Empty>}
    </div>
  );
}
