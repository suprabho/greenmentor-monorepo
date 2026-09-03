"use client";

import { useEffect } from "react";
import type { VizRenderProps } from "@vismay/viz-engine";
import { useShareCardJob } from "../../dataContext";
import { cardDateOnly } from "../shared";
import { flagEmojiFor, jobCountryOf, locationWithCountry } from "../../countryFlag";
import { EntityChipRow } from "../chips/EntityChipRow";
import type { GmJobConfig } from "./index";

/** Two-letter company mark (local copy in spirit of the platform board's
 *  monogram — different workspace, so no cross-app import). */
function monogramOf(company: string | null, title: string): string {
  return (
    (company ?? title)
      .replace(/[^A-Za-z0-9]/g, "")
      .slice(0, 2)
      .toUpperCase() || "GM"
  );
}

/** `gmcard:job` — a published job opening as the card's hero: company monogram
 *  + eyebrow, role title, optional description/meta/salary/deadline/tag chips.
 *  Jobs have no artwork column, so the layout is purely typographic. All colors
 *  run through the frame's --gmcard-* vars so the layer follows the card theme. */
export default function JobCardComponent({ config, noteReady }: VizRenderProps<GmJobConfig>) {
  const job = useShareCardJob(config.jobId);

  useEffect(() => {
    if (!job) return;
    const h = requestAnimationFrame(() => noteReady());
    return () => cancelAnimationFrame(h);
  }, [job, noteReady]);

  if (!job) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-[13px]" style={{ color: "var(--gmcard-muted)" }}>
        Pick a job →
      </div>
    );
  }

  const compact = config.variant === "compact";

  const monogram = !config.hideMonogram ? (
    <div
      className="grid shrink-0 place-items-center rounded-xl font-bold"
      style={{
        width: compact ? 40 : 52,
        height: compact ? 40 : 52,
        fontSize: compact ? 15 : 19,
        background: "var(--gmcard-accent)",
        color: "rgba(0,0,0,0.78)",
      }}
    >
      {monogramOf(job.company, job.title)}
    </div>
  ) : null;

  const company = !config.hideCompany ? (
    <div
      className="text-[13px] font-bold uppercase tracking-[1.6px]"
      style={{ color: "var(--gmcard-accent)" }}
    >
      {job.company ?? "Confidential"}
    </div>
  ) : null;

  const title = (
    <div
      className="font-extrabold"
      style={{
        color: "var(--gmcard-text)",
        fontSize: compact ? 22 : 32,
        lineHeight: 1.12,
        letterSpacing: "-0.01em",
      }}
    >
      {job.title}
    </div>
  );

  const details =
    !config.hideDetails && !compact && job.details ? (
      <p className="line-clamp-3 text-[15px] leading-relaxed" style={{ color: "var(--gmcard-muted)" }}>
        {job.details}
      </p>
    ) : null;

  // Location reads as a headline fact, not a footnote, so it gets its own row
  // above the rest of the meta at a size a viewer can catch at a glance. The
  // country rides along (appended unless the location already ends with it)
  // and its flag leads the row — a glyph the eye catches before any text.
  const country = jobCountryOf(job);
  const flag = flagEmojiFor(country);
  const locationText = locationWithCountry(job.location, country);
  const locationRow =
    !config.hideMeta && locationText ? (
      <div
        className="flex items-center gap-2 font-semibold"
        style={{
          color: "var(--gmcard-text)",
          fontSize: compact ? 15 : 19,
          lineHeight: 1.2,
        }}
      >
        {flag && (
          <span
            aria-label={country ?? undefined}
            role="img"
            className="shrink-0"
            style={{
              // Noto first so the studio preview and the headless export (Linux
              // Chromium with no system emoji font) draw the same flag; the
              // platform emoji fonts follow so a missing web font still shows one.
              fontFamily: '"Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif',
              fontSize: compact ? 17 : 22,
              lineHeight: 1,
            }}
          >
            {flag}
          </span>
        )}
        <span>{locationText}</span>
      </div>
    ) : null;

  const meta = [
    job.employment_type,
    job.experience ?? job.seniority,
    cardDateOnly(job.posted_on),
  ].filter(Boolean);
  const metaRow =
    !config.hideMeta && meta.length > 0 ? (
      <div className="text-[12px] font-medium" style={{ color: "var(--gmcard-muted)" }}>
        {meta.join(" · ")}
      </div>
    ) : null;

  const salary =
    !config.hideSalary && job.salary ? (
      <div className="text-[14px] font-semibold" style={{ color: "var(--gmcard-accent)" }}>
        {job.salary}
      </div>
    ) : null;
  const deadline =
    !config.hideDeadline && job.application_deadline ? (
      <div className="text-[12px]" style={{ color: "var(--gmcard-muted)" }}>
        Apply by {cardDateOnly(job.application_deadline)}
      </div>
    ) : null;
  const factsRow =
    salary || deadline ? (
      <div className="flex items-center gap-4">
        {salary}
        {deadline}
      </div>
    ) : null;

  const chips =
    !config.hideTags && job.tags.length > 0 ? (
      <EntityChipRow
        entities={job.tags.map((t) => ({ slug: t, name: t, kind: "tag" }))}
        max={5}
        tone="glass"
      />
    ) : null;

  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-3 px-1">
      {(monogram || company) && (
        <div className="flex items-center gap-3.5">
          {monogram}
          {company}
        </div>
      )}
      {title}
      {details}
      {/* Location and the rest of the meta are one block: a tighter gap than the
          card's own, so the two rows read together rather than as separate facts. */}
      {(locationRow || metaRow) && (
        <div className="flex flex-col gap-1">
          {locationRow}
          {metaRow}
        </div>
      )}
      {factsRow}
      {chips}
    </div>
  );
}
