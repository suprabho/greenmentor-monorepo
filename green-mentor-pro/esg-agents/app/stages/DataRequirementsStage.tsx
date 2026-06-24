"use client";

import { C, ACCENT } from "./theme";
import { Card, SectionLabel, Field, Chip, Accordion, Donut, BarChart, Empty, arr } from "./primitives";
import type { DataRequirementsArtifact, DataRequest, FormSchema } from "./types";

const CHANNEL_COLORS: Record<string, string> = { portal: ACCENT, upload: "#2848b8", email: "#b8860b", whatsapp: "#5db38f" };
const SITE_PALETTE = ["#1f8a5b", "#3a9b73", "#5db38f", "#b8860b", "#2848b8"];

function countBy<T>(rows: T[], key: (r: T) => string | undefined): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].map(([label, value]) => ({ label, value }));
}

function RequestCard({ r }: { r: DataRequest }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderLeft: `3px solid ${ACCENT}`, borderRadius: 10, padding: 12, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 650, fontSize: 13.5 }}>{r.label ?? r.dp_id ?? "—"}</div>
          {!!arr(r.metric_ids).length && (
            <div style={{ fontSize: 11.5, color: "#8a958f", fontFamily: "ui-monospace, Menlo, monospace" }}>{(r.metric_ids ?? []).join(", ")}</div>
          )}
        </div>
        {r.unit && <span style={{ background: "#e9f2ec", color: ACCENT, fontSize: 12, fontWeight: 700, padding: "3px 9px", borderRadius: 7, whiteSpace: "nowrap" }}>{r.unit}</span>}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "10px 0" }}>
        <Field label="Sites" value={arr<string>(r.sites).join(", ") || undefined} />
        <Field label="Period" value={r.period} />
        <Field label="Granularity" value={r.granularity?.replace(/_/g, " ")} />
        <Field label="Owner" value={r.owner_role ?? undefined} />
        <Field label="Channel" value={r.channel} />
        <Field label="Deadline" value={r.deadline ?? undefined} />
      </div>
      {!!arr(r.disclosure_codes).length && (
        <div style={{ marginBottom: 8 }}>
          <SectionLabel>Feeds disclosures</SectionLabel>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {(r.disclosure_codes ?? []).map((c, i) => (
              <Chip key={i}>{c}</Chip>
            ))}
          </div>
        </div>
      )}
      {!!arr(r.evidence_required).length && (
        <div style={{ fontSize: 12, color: C.sub }}>
          <strong style={{ color: "#8a958f" }}>Evidence:</strong> {(r.evidence_required ?? []).join(" · ")}
        </div>
      )}
    </div>
  );
}

export default function DataRequirementsStage({ o }: { o: Record<string, unknown> }) {
  const a = o as DataRequirementsArtifact;
  const requests = arr<DataRequest>(a.requests);
  const forms = arr<FormSchema>(a.form_schemas);
  const unmapped = arr<{ topic_id?: string; reason?: string }>(a.unmapped_topics);

  const byChannel = countBy(requests, (r) => r.channel).map((d) => ({ ...d, color: CHANNEL_COLORS[d.label] ?? C.blocked }));
  const bySite = countBy(requests, (r) => arr<string>(r.sites)[0]).map((d, i) => ({ ...d, color: SITE_PALETTE[i % SITE_PALETTE.length] }));

  const channels = [...new Set(requests.map((r) => r.channel ?? "—"))];

  return (
    <div>
      <Card title={`Data requests · ${requests.length}`} accent={ACCENT} right={forms.length ? <Chip>{forms.length} portal forms</Chip> : undefined}>
        {a.coverage_note && <div style={{ fontSize: 13, color: C.sub, marginBottom: 12, lineHeight: 1.5 }}>{a.coverage_note}</div>}
        {requests.length ? (
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 20, alignItems: "center" }}>
            <div>
              <SectionLabel>By channel</SectionLabel>
              <Donut segments={byChannel} centerLabel="requests" />
            </div>
            <div>
              <SectionLabel>By site</SectionLabel>
              <BarChart data={bySite} />
            </div>
          </div>
        ) : (
          <Empty>No data requests.</Empty>
        )}
      </Card>

      {!!requests.length && (
        <Card title="Requests by channel">
          <Accordion
            items={channels.map((ch) => {
              const rows = requests.filter((r) => (r.channel ?? "—") === ch);
              return {
                key: ch,
                title: <strong style={{ textTransform: "capitalize" }}>{ch}</strong>,
                right: <Chip>{rows.length}</Chip>,
                children: (
                  <div style={{ paddingTop: 10 }}>
                    {rows.map((r, i) => (
                      <RequestCard key={r.request_id ?? i} r={r} />
                    ))}
                  </div>
                ),
              };
            })}
          />
        </Card>
      )}

      {!!forms.length && (
        <Card title={`Portal forms · ${forms.length}`}>
          <Accordion
            items={forms.map((f, i) => ({
              key: f.form_schema_ref ?? String(i),
              title: <strong>{f.title ?? f.form_schema_ref ?? "Form"}</strong>,
              right: <Chip>{arr(f.fields).length} fields</Chip>,
              children: (
                <div style={{ paddingTop: 8, display: "grid", gap: 6 }}>
                  {arr<NonNullable<FormSchema["fields"]>[number]>(f.fields).map((fld, j) => (
                    <div key={j} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.sub, borderBottom: `1px solid ${C.border}`, paddingBottom: 5 }}>
                      <span style={{ color: C.text }}>
                        {fld.label ?? fld.name} {fld.required && <span style={{ color: C.low }}>*</span>}
                      </span>
                      <span>
                        {fld.type}
                        {fld.unit ? ` · ${fld.unit}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ),
            }))}
          />
        </Card>
      )}

      {!!unmapped.length && (
        <Card title="Unmapped topics" accent={C.medium}>
          {unmapped.map((u, i) => (
            <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 6 }}>
              <strong>{u.topic_id ?? "—"}</strong> — <span style={{ color: C.sub }}>{u.reason ?? "—"}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
