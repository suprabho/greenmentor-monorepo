"use client";

import { useState } from "react";
import { Plus, Minus } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import {
  topHiringCompanies,
  moreHiringCompanies,
} from "@/lib/data/hiring-companies";
import { track } from "@/lib/utils/analytics";

/**
 * "Where our learners go" — top-10 hiring companies always visible, plus a
 * progressive-disclosure long-tail of 40 more, expandable inline. The
 * gray secondary pills mirror the v3 HTML's `.co-pill-gray` device.
 */
export function HiringCompanies() {
  const [open, setOpen] = useState(false);
  const moreCount = moreHiringCompanies.length;

  return (
    <section className="bg-white py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="Where our learners go"
          title={
            <>
              Position yourself for ESG roles at{" "}
              <span className="text-green-700">
                India&apos;s leading organisations.
              </span>
            </>
          }
          description="The firms hiring through our community span Indian conglomerates, Big-4 advisories, and global energy & climate players."
        />

        <div className="mt-14 rounded-[20px] border border-gray-200 bg-section-fade p-6 md:p-8">
          <p className="gm-eyebrow text-green-700">Top hiring companies</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topHiringCompanies.map((co) => (
              <span
                key={co}
                className="rounded-full bg-green-100 px-3 py-1.5 text-[13px] font-semibold text-teal-900"
              >
                {co}
              </span>
            ))}
          </div>

          {open ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {moreHiringCompanies.map((co) => (
                <span
                  key={co}
                  className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[13px] text-gray-700"
                >
                  {co}
                </span>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => {
              const next = !open;
              setOpen(next);
              if (next) track("hiring_companies_expanded");
            }}
            className="mt-5 inline-flex items-center gap-1.5 rounded-full border border-green-500/60 px-4 py-1.5 text-[13px] font-semibold text-green-700 transition-colors hover:bg-green-100"
          >
            {open ? (
              <>
                <Minus size={14} weight="bold" /> Show less
              </>
            ) : (
              <>
                <Plus size={14} weight="bold" /> See {moreCount} more companies
              </>
            )}
          </button>
        </div>
      </Container>
    </section>
  );
}
