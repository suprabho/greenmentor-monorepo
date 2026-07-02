"use client";

import { Chip } from "@/components/ui";
import { ObjectView } from "./generic";

/**
 * Purpose-built renderer for the kickoff Scope Plan artifact. The generic
 * key/value dump made the RACI matrix and project plan hard to read — this
 * lays each block out in its natural form: RACI as a matrix with a plain-
 * language legend, the plan as a milestone timeline, the charter as
 * in/out-of-scope checklists.
 */

interface Framework {
  framework?: string;
  mandatory?: boolean;
  rationale?: string;
}

interface ScopeCharter {
  objectives?: string[];
  out_of_scope?: string[];
  reporting_boundary?: string;
  frameworks_in_scope?: Framework[];
}

interface PlanPhase {
  phase?: string;
  phase_no?: number;
  milestone?: string;
  depends_on?: number[];
  target_date?: string;
}

interface RaciRow {
  activity?: string;
  responsible?: string;
  accountable?: string;
  consulted?: string;
  informed?: string;
}

export interface ScopePlanPayload {
  scope_charter?: ScopeCharter;
  project_plan?: PlanPhase[];
  raci_matrix?: RaciRow[];
  open_questions?: string[];
  [key: string]: unknown;
}

const SCOPE_PLAN_KEYS = ["scope_charter", "project_plan", "raci_matrix", "open_questions"];

export function isScopePlanPayload(payload: unknown): payload is ScopePlanPayload {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false;
  const o = payload as Record<string, unknown>;
  return Boolean(o.raci_matrix || o.project_plan || o.scope_charter);
}

function arr<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function fmtDate(iso?: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** Split "Client CSO, Site EHS Managers (Pune, Chennai), HR Head" on top-level commas only. */
function splitParties(v?: string): string[] {
  if (!v) return [];
  return v
    .split(/,(?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isGreenMentor(party: string): boolean {
  return /greenmentor/i.test(party);
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="py-5 first:pt-0 last:pb-0">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-[14px] font-semibold tracking-tight text-ink">{title}</h2>
        {hint && <p className="text-[11.5px] text-gray-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------- Scope charter ------------------------------ */

function ScopeCharterSection({ charter }: { charter: ScopeCharter }) {
  const objectives = arr<string>(charter.objectives);
  const outOfScope = arr<string>(charter.out_of_scope);
  const frameworks = arr<Framework>(charter.frameworks_in_scope);

  return (
    <>
      {objectives.length > 0 && (
        <Section title="Objectives" hint="What this engagement will deliver">
          <ul className="space-y-1.5">
            {objectives.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-gray-800">
                <span className="mt-px shrink-0 font-bold text-green-700" aria-hidden>
                  ✓
                </span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {charter.reporting_boundary && (
        <Section title="Reporting boundary" hint="Which entities and sites the report covers">
          <p className="rounded-xl bg-gray-50 p-3.5 text-[12.5px] leading-relaxed text-gray-700">
            {charter.reporting_boundary}
          </p>
        </Section>
      )}

      {frameworks.length > 0 && (
        <Section title="Frameworks in scope" hint="Mandatory = required by regulation · voluntary = recommended">
          <div className="grid gap-2.5 sm:grid-cols-2">
            {frameworks.map((f, i) => (
              <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-ink">{f.framework ?? "—"}</span>
                  <Chip tone={f.mandatory ? "green" : "neutral"}>{f.mandatory ? "mandatory" : "voluntary"}</Chip>
                </div>
                {f.rationale && <p className="text-[12px] leading-relaxed text-gray-600">{f.rationale}</p>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {outOfScope.length > 0 && (
        <Section title="Out of scope" hint="Explicitly excluded — needs a separate engagement">
          <ul className="space-y-1.5">
            {outOfScope.map((x, i) => (
              <li key={i} className="flex gap-2.5 text-[12.5px] leading-relaxed text-gray-500">
                <span className="mt-px shrink-0 font-bold text-gray-400" aria-hidden>
                  ✕
                </span>
                <span>{x}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </>
  );
}

/* ------------------------------- Project plan ------------------------------- */

function MilestoneList({ milestone }: { milestone?: string }) {
  if (!milestone) return null;
  const items = milestone
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  if (items.length <= 1) {
    return <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">{milestone}</p>;
  }
  return (
    <ul className="mt-1.5 space-y-1">
      {items.map((x, i) => (
        <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-gray-600">
          <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full bg-green-500" aria-hidden />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

function ProjectPlanSection({ plan }: { plan: PlanPhase[] }) {
  const phases = [...plan].sort((a, b) => (a.phase_no ?? 0) - (b.phase_no ?? 0));
  return (
    <Section
      title={`Project plan · ${phases.length} phase${phases.length === 1 ? "" : "s"}`}
      hint="Each phase must complete before the next starts"
    >
      <ol>
        {phases.map((p, i) => (
          <li key={i} className="relative flex gap-3.5 pb-5 last:pb-0">
            <div className="flex flex-col items-center">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-900 text-[11.5px] font-bold text-white">
                {p.phase_no ?? i + 1}
              </span>
              {i < phases.length - 1 && <span className="mt-1.5 w-px flex-1 bg-gray-200" aria-hidden />}
            </div>
            <div className="min-w-0 flex-1 pb-1 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <h3 className="text-[13px] font-semibold text-ink">{p.phase ?? "—"}</h3>
                {fmtDate(p.target_date) && (
                  <span className="whitespace-nowrap text-[11.5px] font-semibold text-teal-700">
                    due {fmtDate(p.target_date)}
                  </span>
                )}
              </div>
              <MilestoneList milestone={p.milestone} />
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ------------------------------- RACI matrix -------------------------------- */

const RACI_COLS = [
  { key: "responsible", letter: "R", label: "Responsible", desc: "does the work", badge: "bg-green-700 text-white" },
  { key: "accountable", letter: "A", label: "Accountable", desc: "owns the outcome", badge: "bg-teal-900 text-white" },
  { key: "consulted", letter: "C", label: "Consulted", desc: "gives input", badge: "bg-green-100 text-teal-800" },
  { key: "informed", letter: "I", label: "Informed", desc: "kept in the loop", badge: "bg-gray-100 text-gray-600" },
] as const;

function RaciBadge({ col }: { col: (typeof RACI_COLS)[number] }) {
  return (
    <span
      className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md text-[10.5px] font-bold ${col.badge}`}
      aria-hidden
    >
      {col.letter}
    </span>
  );
}

function PartyList({ value }: { value?: string }) {
  const parts = splitParties(value);
  if (!parts.length) return <span className="text-gray-400">—</span>;
  return (
    <div className="space-y-1">
      {parts.map((p, i) => (
        <div
          key={i}
          className={`text-[12px] leading-snug ${isGreenMentor(p) ? "font-semibold text-green-700" : "text-gray-700"}`}
        >
          {p}
        </div>
      ))}
    </div>
  );
}

function RaciSection({ raci }: { raci: RaciRow[] }) {
  const hasGreenMentorParties = raci.some((r) =>
    RACI_COLS.some((c) => splitParties(r[c.key]).some(isGreenMentor))
  );
  return (
    <Section title="RACI matrix" hint="Who does what, per activity">
      {/* Legend: spell out the acronym so the matrix is self-explanatory. */}
      <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {RACI_COLS.map((c) => (
          <span key={c.key} className="inline-flex items-center gap-1.5 text-[11.5px] text-gray-500">
            <RaciBadge col={c} />
            <span>
              <span className="font-semibold text-gray-700">{c.label}</span> — {c.desc}
            </span>
          </span>
        ))}
      </div>

      {/* Desktop: real matrix */}
      <table className="hidden w-full border-collapse text-left sm:table">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="w-[30%] pb-2 pr-4 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Activity
            </th>
            {RACI_COLS.map((c) => (
              <th key={c.key} className="pb-2 pr-3 last:pr-0">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                  <RaciBadge col={c} />
                  {c.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {raci.map((r, i) => (
            <tr key={i} className="align-top">
              <td className="py-3 pr-4 text-[12.5px] font-medium leading-snug text-ink">{r.activity ?? "—"}</td>
              {RACI_COLS.map((c) => (
                <td key={c.key} className="py-3 pr-3 last:pr-0">
                  <PartyList value={r[c.key]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile: one card per activity, roles in fixed R→A→C→I order */}
      <div className="space-y-2.5 sm:hidden">
        {raci.map((r, i) => (
          <div key={i} className="rounded-xl border border-gray-100 bg-gray-50 p-3.5">
            <div className="mb-2.5 text-[13px] font-semibold leading-snug text-ink">{r.activity ?? "—"}</div>
            <div className="space-y-2">
              {RACI_COLS.map((c) => (
                <div key={c.key} className="flex gap-2.5">
                  <RaciBadge col={c} />
                  <PartyList value={r[c.key]} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {hasGreenMentorParties && (
        <p className="mt-3 text-[11px] text-gray-400">
          <span className="font-semibold text-green-700">Green names</span> are GreenMentor team · grey names are
          client-side owners
        </p>
      )}
    </Section>
  );
}

/* ------------------------------ Open questions ------------------------------ */

function OpenQuestionsSection({ questions }: { questions: string[] }) {
  return (
    <Section
      title={`Open questions · ${questions.length}`}
      hint="Client input needed before the plan can be finalised"
    >
      <ol className="space-y-2">
        {questions.map((q, i) => (
          <li key={i} className="flex gap-3">
            <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full bg-[#FFF4E0] text-[11px] font-bold text-[#B25E00]">
              {i + 1}
            </span>
            <span className="pt-0.5 text-[13px] leading-relaxed text-gray-800">{q}</span>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* --------------------------------- Assembly --------------------------------- */

export function ScopePlanArtifact({ payload }: { payload: ScopePlanPayload }) {
  const plan = arr<PlanPhase>(payload.project_plan);
  const raci = arr<RaciRow>(payload.raci_matrix);
  const questions = arr<string>(payload.open_questions);
  // Anything the agent added beyond the known blocks still shows up (generic render).
  const extras = Object.fromEntries(Object.entries(payload).filter(([k]) => !SCOPE_PLAN_KEYS.includes(k)));

  return (
    <div className="divide-y divide-gray-100">
      {payload.scope_charter && <ScopeCharterSection charter={payload.scope_charter} />}
      {plan.length > 0 && <ProjectPlanSection plan={plan} />}
      {raci.length > 0 && <RaciSection raci={raci} />}
      {questions.length > 0 && <OpenQuestionsSection questions={questions} />}
      {Object.keys(extras).length > 0 && (
        <Section title="Other details">
          <ObjectView o={extras} />
        </Section>
      )}
    </div>
  );
}
