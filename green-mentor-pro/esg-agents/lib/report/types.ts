/** The assembled BRSR report model (pure data; rendered by lib/report/render.ts). */
export interface HeadlineMetric {
  label: string;
  value: string | number;
  unit?: string | null;
  period?: string | null;
  yoy_change?: string | null;
}

export interface ReportSection {
  section_id: string;
  title: string;
  body_markdown: string;
}

export interface Disclosure {
  code: string;
  question_id: string | null;
  answer: string;
  comment?: string | null;
  note?: string | null;
  status?: string | null;
  unit?: string | null;
}

export interface PrincipleBlock {
  principle: number;
  title: string;
  essential: Disclosure[];
  leadership: Disclosure[];
}

export interface Kpi {
  label: string;
  value: string | number;
  unit?: string | null;
  confidence?: string | null;
}

export interface ConsistencyIssue {
  where: string;
  finding: string;
  severity: string;
}

export interface BrsrReportModel {
  meta: { clientName: string; financialYear: string; frameworks: string[]; generatedAt?: string | null };
  cover: { headlineMetrics: HeadlineMetric[]; highlights: string[] };
  sections: ReportSection[];
  principles: PrincipleBlock[];
  otherDisclosures: Disclosure[];
  kpis: Kpi[];
  scopeTotals: Record<string, number | null> | null;
  assumptions: string[];
  consistencyIssues: ConsistencyIssue[];
  empty: boolean; // true when no report artifacts exist yet
}
