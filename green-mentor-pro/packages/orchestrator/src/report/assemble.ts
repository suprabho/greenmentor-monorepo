import { BRSR_PRINCIPLES, parseBrsrCode } from "./brsrTaxonomy";
import type { BrsrReportModel, Disclosure, PrincipleBlock, ReportSection, Kpi, HeadlineMetric } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AssembleInput {
  engagement: { client_name: string; financial_year: string; framework: string[] };
  reportDrafting?: any; // report_outline, report_sections, disclosure_drafts
  publication?: any; // final_sections, investor_summary, consistency_issues
  calculation?: any; // kpis, scope_totals, disclosure_mappings
  assumptions?: string[];
  generatedAt?: string;
}

const UNRESOLVED = /unresolved|\[unresolved\]|pending|not provided/i;

function orderedSections(input: AssembleInput): ReportSection[] {
  const final = (input.publication?.final_sections ?? []) as any[];
  const drafted = (input.reportDrafting?.report_sections ?? []) as any[];
  const base = final.length ? final : drafted;
  const byId = new Map(base.map((s) => [s.section_id, s]));
  const outline = (input.reportDrafting?.report_outline ?? []) as any[];
  const ordered = outline.length
    ? outline.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).map((o) => byId.get(o.section_id)).filter(Boolean)
    : base;
  // include any sections not present in the outline, appended in original order
  const seen = new Set(ordered.map((s: any) => s.section_id));
  const rest = base.filter((s) => !seen.has(s.section_id));
  return [...ordered, ...rest].map((s: any) => ({
    section_id: String(s.section_id ?? ""),
    title: String(s.title ?? s.section_id ?? "Section"),
    body_markdown: String(s.body_markdown ?? ""),
  }));
}

function mergeDisclosures(input: AssembleInput): { principles: PrincipleBlock[]; other: Disclosure[] } {
  const drafts = (input.reportDrafting?.disclosure_drafts ?? []) as any[];
  const mappings = (input.calculation?.disclosure_mappings ?? []) as any[];
  const map = new Map<string, Disclosure>();

  const keyOf = (d: any) => String(d.question_id ?? d.disclosure_code ?? Math.random());

  for (const d of drafts) {
    map.set(keyOf(d), {
      code: String(d.disclosure_code ?? ""),
      question_id: d.question_id ?? null,
      answer: String(d.answer ?? ""),
      comment: d.comment ?? null,
      note: d.note ?? null,
      status: d.status ?? null,
    });
  }
  for (const m of mappings) {
    const key = keyOf(m);
    const existing = map.get(key);
    const calcAnswer = m.answer != null ? `${m.answer}${m.unit ? ` ${m.unit}` : ""}` : "";
    if (existing) {
      // calc wins on a numeric answer when the draft prose is unresolved
      if (UNRESOLVED.test(existing.answer) && calcAnswer) existing.answer = calcAnswer;
      existing.unit = existing.unit ?? m.unit ?? null;
      existing.comment = existing.comment ?? m.comment ?? null;
      existing.note = existing.note ?? m.note ?? null;
    } else {
      map.set(key, {
        code: String(m.disclosure_code ?? ""),
        question_id: m.question_id ?? null,
        answer: calcAnswer,
        comment: m.comment ?? null,
        note: m.note ?? null,
        status: m.status ?? null,
        unit: m.unit ?? null,
      });
    }
  }

  const byPrinciple = new Map<number, PrincipleBlock>();
  const other: Disclosure[] = [];
  for (const d of map.values()) {
    const parsed = parseBrsrCode(`${d.code} ${d.question_id ?? ""}`);
    if (!parsed.isBrsr || parsed.principle == null) {
      other.push(d);
      continue;
    }
    if (!byPrinciple.has(parsed.principle)) {
      byPrinciple.set(parsed.principle, { principle: parsed.principle, title: BRSR_PRINCIPLES[parsed.principle], essential: [], leadership: [] });
    }
    const block = byPrinciple.get(parsed.principle)!;
    if (parsed.indicator === "L") block.leadership.push(d);
    else block.essential.push(d);
  }
  const principles = [...byPrinciple.values()].sort((a, b) => a.principle - b.principle);
  return { principles, other };
}

function headlineMetrics(input: AssembleInput): HeadlineMetric[] {
  return ((input.publication?.investor_summary?.headline_metrics ?? []) as any[]).map((m) => ({
    label: String(m.label ?? ""),
    value: m.value ?? "",
    unit: m.unit ?? null,
    period: m.period ?? null,
    yoy_change: m.yoy_change ?? null,
  }));
}

function kpis(input: AssembleInput): Kpi[] {
  return ((input.calculation?.kpis ?? []) as any[]).map((k) => ({
    label: String(k.label ?? k.kpi_code ?? ""),
    value: k.value ?? "",
    unit: k.unit ?? null,
    confidence: k.calc_confidence ?? null,
  }));
}

/** Pure assembly of the BRSR report model from the stored final artifacts. */
export function assembleBrsrReport(input: AssembleInput): BrsrReportModel {
  const sections = orderedSections(input);
  const { principles, other } = mergeDisclosures(input);
  const k = kpis(input);
  const empty = sections.length === 0 && principles.length === 0 && other.length === 0 && k.length === 0;

  return {
    meta: {
      clientName: input.engagement.client_name,
      financialYear: input.engagement.financial_year,
      frameworks: input.engagement.framework ?? ["BRSR"],
      generatedAt: input.generatedAt ?? null,
    },
    cover: {
      headlineMetrics: headlineMetrics(input),
      highlights: (input.publication?.investor_summary?.highlights ?? []).map(String),
    },
    sections,
    principles,
    otherDisclosures: other,
    kpis: k,
    scopeTotals: (input.calculation?.scope_totals ?? null) as Record<string, number | null> | null,
    assumptions: input.assumptions ?? [],
    consistencyIssues: (input.publication?.consistency_issues ?? []) as any[],
    empty,
  };
}
