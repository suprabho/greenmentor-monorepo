"use client";

import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { Button } from "@/components/marketing-ui/Button";
import { track } from "@/lib/utils/analytics";

/**
 * "For Teams" (G-7) — a B2B on-ramp. Corporate buyers land on the membership
 * page with no path of their own; this gives them one. Anchored at #teams so
 * the new nav link resolves.
 */
export function TeamSection() {
  return (
    <section id="teams" className="bg-teal-900 py-20 text-white md:py-24">
      <Container width="wide">
        <div className="rounded-[24px] border border-white/10 bg-teal-800/40 p-8 md:p-12">
          <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <p className="gm-eyebrow text-green-100">For Teams</p>
              <h2 className="font-display mt-4 text-[28px] leading-tight text-white md:text-[36px]">
                Upskilling your team?
              </h2>
              <p className="mt-4 text-[16px] leading-relaxed text-white/85 md:text-[18px]">
                Team plans for 5+ professionals: custom pricing, an admin
                dashboard, progress tracking, and dedicated onboarding.
              </p>
              {/* TODO[data]: confirm the exact client count + named logos. */}
              <p className="mt-4 text-[14px] text-green-100">
                Used by Tata Group, Nestlé, TUV Rheinland and 45+ more teams.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-start gap-3">
              <Button
                asChild
                variant="accent"
                size="lg"
                className="w-full sm:w-auto"
                iconRight={<ArrowRight size={18} weight="bold" />}
              >
                <Link
                  href="mailto:help@greenmentor.co?subject=Team%20plans"
                  onClick={() =>
                    track("cta_clicked", {
                      location: "teams",
                      label: "talk_team",
                    })
                  }
                >
                  Talk to us about team plans
                </Link>
              </Button>
              <p className="text-[13px] text-white/70">
                help@greenmentor.co · +91 8744943433
              </p>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
