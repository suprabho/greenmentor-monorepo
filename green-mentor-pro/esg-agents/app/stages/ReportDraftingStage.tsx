"use client";

import { C, ACCENT } from "./theme";
import { Card, SectionLabel, Chip, Accordion, StatusBadge, Donut, ProgressBar, MarkdownBlock, Bullets, Empty, arr } from "./primitives";
import type { ReportDraftingArtifact } from "./types";

export default function ReportDraftingStage({ o }: { o: Record<string, unknown> }) {
  const a = o as ReportDraftingArtifact;
  const outline = arr<NonNullable<ReportDraftingArtifact["report_outline"]>[number]>(a.report_outline);
  const sections = arr<NonNullable<ReportDraftingArtifact["report_sections"]>[number]>(a.report_sections);
  const drafts = arr<NonNullable<ReportDraftingArtifact["disclosure_drafts"]>[number]>(a.disclosure_drafts);

  const drafted = drafts.filter((d) => d.status === "Drafted").length;
  const ordered = [...sections].sort((x, y) => {
    const ox = outline.find((s) => s.section_id === x.section_id)?.order ?? 99;
    const oy = outline.find((s) => s.section_id === y.section_id)?.order ?? 99;
    return ox - oy;
  });

  return (
    <div>
      <Card title="Report draft" accent={ACCENT} right={<Chip>{sections.length} sections</Chip>}>
        {!!drafts.length && (
          <>
            <SectionLabel>Disclosures drafted</SectionLabel>
            <ProgressBar value={drafted} max={drafts.length} />
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
              {drafted} of {drafts.length} disclosures drafted
            </div>
          </>
        )}
      </Card>

      {!!outline.length && (
        <Card title="Outline">
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {[...outline]
              .sort((x, y) => (x.order ?? 99) - (y.order ?? 99))
              .map((s, i) => (
                <li key={s.section_id ?? i} style={{ fontSize: 13, color: C.text, margin: "4px 0" }}>
                  {s.title ?? s.section_id ?? "—"}
                </li>
              ))}
          </ol>
        </Card>
      )}

      {!!sections.length && (
        <Card title={`Sections · ${sections.length}`}>
          <Accordion
            items={ordered.map((s, i) => ({
              key: s.section_id ?? String(i),
              defaultOpen: i === 0,
              title: <strong>{s.title ?? s.section_id ?? "Section"}</strong>,
              right: arr(s.data_refs).length || arr(s.chart_refs).length ? <Chip>{arr(s.data_refs).length + arr(s.chart_refs).length} refs</Chip> : undefined,
              children: (
                <div style={{ paddingTop: 10 }}>
                  <MarkdownBlock md={s.body_markdown} />
                  {(!!arr(s.chart_refs).length || !!arr(s.data_refs).length) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 8 }}>
                      {[...arr<string>(s.chart_refs), ...arr<string>(s.data_refs)].map((r, j) => (
                        <Chip key={j}>{r}</Chip>
                      ))}
                    </div>
                  )}
                </div>
              ),
            }))}
          />
        </Card>
      )}

      {!!drafts.length && (
        <Card title={`Disclosure drafts · ${drafts.length}`}>
          <div style={{ marginBottom: 12 }}>
            <Donut
              segments={[
                { label: "Drafted", value: drafted, color: ACCENT },
                { label: "Pending", value: drafts.length - drafted, color: C.blocked },
              ]}
              centerLabel="drafts"
            />
          </div>
          <Accordion
            items={drafts.map((d, i) => ({
              key: d.disclosure_code ?? String(i),
              title: <span style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12.5 }}>{d.disclosure_code ?? "—"}</span>,
              right: <StatusBadge value={d.status} />,
              children: (
                <div style={{ paddingTop: 8 }}>
                  <MarkdownBlock md={d.answer} />
                  {d.comment && <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{d.comment}</div>}
                </div>
              ),
            }))}
          />
        </Card>
      )}

      {!!arr(a.qa_notes).length && (
        <Card title="QA notes">
          <Bullets items={a.qa_notes ?? []} />
        </Card>
      )}

      {!sections.length && !drafts.length && <Empty>No drafted report yet.</Empty>}
    </div>
  );
}
