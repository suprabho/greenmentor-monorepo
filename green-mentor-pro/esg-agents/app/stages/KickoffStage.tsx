"use client";

import { C, ACCENT } from "./theme";
import { Card, SectionLabel, KeyVal, Bullets, Accordion, Table, Empty, arr } from "./primitives";
import type { KickoffArtifact } from "./types";

export default function KickoffStage({ o, hideOpenQuestions }: { o: Record<string, unknown>; hideOpenQuestions?: boolean }) {
  const a = o as KickoffArtifact;
  const charter = a.scope_charter ?? {};
  const frameworks = arr<{ framework?: string; rationale?: string; mandatory?: boolean }>(charter.frameworks_in_scope);
  const plan = arr<NonNullable<KickoffArtifact["project_plan"]>[number]>(a.project_plan);
  const raci = arr<NonNullable<KickoffArtifact["raci_matrix"]>[number]>(a.raci_matrix);
  const questions = arr<string>(a.open_questions);

  return (
    <div>
      <Card title="Scope charter" accent={ACCENT}>
        {charter.reporting_boundary && <KeyVal label="Reporting boundary" value={charter.reporting_boundary} />}
        {!!arr(charter.objectives).length && (
          <div style={{ marginTop: 10 }}>
            <SectionLabel>Objectives</SectionLabel>
            <Bullets items={charter.objectives ?? []} check />
          </div>
        )}
        {!!frameworks.length && (
          <div style={{ marginTop: 12 }}>
            <SectionLabel>Frameworks in scope</SectionLabel>
            <Accordion
              items={frameworks.map((f, i) => ({
                key: String(i),
                title: (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                    <strong>{f?.framework ?? "—"}</strong>
                  </span>
                ),
                right: (
                  <span style={{ fontSize: 11, fontWeight: 700, color: f?.mandatory ? ACCENT : C.sub, background: f?.mandatory ? "#e9f2ec" : "#eef1f0", padding: "2px 8px", borderRadius: 6 }}>
                    {f?.mandatory ? "mandatory" : "voluntary"}
                  </span>
                ),
                children: <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55, paddingTop: 8 }}>{f?.rationale ?? "—"}</div>,
              }))}
            />
          </div>
        )}
        {!!arr(charter.out_of_scope).length && (
          <div style={{ marginTop: 12 }}>
            <SectionLabel>Out of scope</SectionLabel>
            <div style={{ display: "grid", gap: 6 }}>
              {(charter.out_of_scope ?? []).map((x, i) => (
                <div key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: C.sub, lineHeight: 1.5 }}>
                  <span style={{ color: C.blocked, fontWeight: 700, flexShrink: 0 }}>✕</span>
                  <span>{x}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Card title={`Project plan${plan.length ? ` · ${plan.length} phases` : ""}`}>
        <Table
          rows={plan}
          emptyText="No project plan."
          columns={[
            { key: "phase_no", header: "#", align: "right", render: (r) => r.phase_no ?? "—", sortValue: (r) => r.phase_no ?? 0 },
            { key: "phase", header: "Phase", render: (r) => <strong>{r.phase ?? "—"}</strong> },
            { key: "milestone", header: "Milestone", render: (r) => <span style={{ color: C.sub }}>{r.milestone ?? "—"}</span> },
            { key: "target_date", header: "Target", render: (r) => r.target_date ?? "—", sortValue: (r) => r.target_date ?? "" },
            { key: "depends_on", header: "Depends on", render: (r) => (arr<number>(r.depends_on).length ? arr<number>(r.depends_on).map((d) => `#${d}`).join(", ") : "—") },
          ]}
        />
      </Card>

      <Card title="RACI matrix">
        <Table
          rows={raci}
          emptyText="No RACI matrix."
          columns={[
            { key: "activity", header: "Activity", render: (r) => <strong>{r.activity ?? "—"}</strong> },
            { key: "responsible", header: "R", render: (r) => r.responsible ?? "—" },
            { key: "accountable", header: "A", render: (r) => r.accountable ?? "—" },
            { key: "consulted", header: "C", render: (r) => <span style={{ color: C.sub }}>{r.consulted ?? "—"}</span> },
            { key: "informed", header: "I", render: (r) => <span style={{ color: C.sub }}>{r.informed ?? "—"}</span> },
          ]}
        />
      </Card>

      {!hideOpenQuestions && (
        <Card title={`Open questions${questions.length ? ` · ${questions.length}` : ""}`}>
          {questions.length ? (
            <ol style={{ margin: 0, paddingLeft: 20 }}>
              {questions.map((q, i) => (
                <li key={i} style={{ fontSize: 13, color: C.text, margin: "6px 0", lineHeight: 1.5 }}>
                  {q}
                </li>
              ))}
            </ol>
          ) : (
            <Empty>No open questions.</Empty>
          )}
        </Card>
      )}
    </div>
  );
}
