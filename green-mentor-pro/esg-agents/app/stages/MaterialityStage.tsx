"use client";

import { C, ACCENT } from "./theme";
import { Card, SectionLabel, Chip, Bullets, Accordion, Table, StatusBadge, ScatterMatrix, Empty, arr } from "./primitives";
import type { MaterialityArtifact, ScoredTopic } from "./types";

export default function MaterialityStage({ o }: { o: Record<string, unknown> }) {
  const a = o as MaterialityArtifact;
  const scored = arr<ScoredTopic>(a.scored_topics);
  const material = arr<NonNullable<MaterialityArtifact["material_topics"]>[number]>(a.material_topics);
  const questionnaire = arr<{ topic_id?: string; question?: string; audience?: string }>(a.questionnaire);
  const threshold = typeof a.materiality_threshold === "number" ? a.materiality_threshold : undefined;

  const statusOf = (id?: string) => material.find((m) => m.topic_id === id)?.status;
  const dotColor = (t: ScoredTopic) => {
    const s = statusOf(t.topic_id);
    return s === "proposed" ? ACCENT : s === "borderline" ? C.medium : material.length ? C.blocked : ACCENT;
  };

  const points = scored.map((t) => ({ x: t.financial_score, y: t.impact_score, label: t.label ?? t.topic_id ?? "—", color: dotColor(t) }));

  return (
    <div>
      <Card
        title="Materiality matrix"
        accent={ACCENT}
        right={threshold != null ? <Chip tone="accent">threshold {threshold}</Chip> : undefined}
      >
        <div style={{ fontSize: 12.5, color: C.sub, marginBottom: 10 }}>
          Impact (Y) × financial (X) materiality. Topics in the shaded top-right quadrant clear the threshold.
        </div>
        <ScatterMatrix points={points} threshold={threshold} />
      </Card>

      <Card title={`Material topics${material.length ? ` · ${material.length}` : ""}`}>
        <Table
          rows={[...material].sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99))}
          emptyText="No material topics."
          columns={[
            { key: "rank", header: "Rank", align: "right", render: (r) => r.rank ?? "—", sortValue: (r) => r.rank ?? 99 },
            { key: "label", header: "Topic", render: (r) => <strong>{r.label ?? r.topic_id ?? "—"}</strong> },
            { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
          ]}
        />
      </Card>

      {!!scored.length && (
        <Card title="Scored topics">
          <Accordion
            items={scored.map((t, i) => ({
              key: String(i),
              title: <strong>{t.label ?? t.topic_id ?? "—"}</strong>,
              right: (
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <Chip>I {t.impact_score ?? "—"}</Chip>
                  <Chip>F {t.financial_score ?? "—"}</Chip>
                </span>
              ),
              children: (
                <div style={{ paddingTop: 8 }}>
                  {t.rationale && <div style={{ fontSize: 13, color: C.text, lineHeight: 1.55, marginBottom: 8 }}>{t.rationale}</div>}
                  {!!arr(t.likely_disclosures).length && (
                    <>
                      <SectionLabel>Likely disclosures</SectionLabel>
                      <Bullets items={t.likely_disclosures ?? []} />
                    </>
                  )}
                </div>
              ),
            }))}
          />
        </Card>
      )}

      {!!questionnaire.length && (
        <Card title={`Stakeholder questionnaire · ${questionnaire.length}`}>
          <div style={{ display: "grid", gap: 8 }}>
            {questionnaire.map((q, i) => (
              <div key={i} style={{ fontSize: 13, color: C.text, borderBottom: `1px solid ${C.border}`, paddingBottom: 8 }}>
                <span style={{ display: "inline-block", marginRight: 8 }}>
                  <Chip>{q.audience ?? "both"}</Chip>
                </span>
                {q.question ?? "—"}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!scored.length && !material.length && <Empty>No materiality data.</Empty>}
    </div>
  );
}
