"use client";

import Link from "next/link";
import { ArrowRight, Check } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { Button } from "@/components/ui/Button";
import { Eyebrow } from "@/components/ui/Badge";
import { plans } from "@/lib/data/plans";
import { guarantee } from "@/lib/data/guarantee";
import { track } from "@/lib/utils/analytics";

export function FinalCta() {
  const plan = plans[0];

  return (
    <section className="relative overflow-hidden bg-teal-900 text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center opacity-40"
        style={{
          height: "300px",
          mixBlendMode: "color-dodge",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/wordmark-outline.svg"
          alt=""
          className="h-full w-auto max-w-none"
        />
      </div>

      <Container width="wide" className="relative py-24 md:py-32">
        <div className="max-w-4xl">
          <Eyebrow tone="teal">Get Started</Eyebrow>

          <h2 className="font-display mt-8 text-[36px] leading-tight text-white md:text-[56px]">
            India&apos;s ESG talent gap is real.{" "}
            <span className="text-green-500">
              3× more roles than qualified professionals.
            </span>
          </h2>
          <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-white/85 md:text-[20px]">
            The question isn&apos;t whether ESG skills matter. It&apos;s whether
            you&apos;ll have them when the opportunity arrives.
          </p>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              asChild
              variant="accent"
              size="lg"
              className="w-full sm:w-auto"
              iconRight={<ArrowRight size={18} weight="bold" />}
            >
              <Link
                href="/onboarding/intro"
                onClick={() =>
                  track("cta_clicked", {
                    location: "final_cta",
                    label: "get_plus",
                  })
                }
              >
                Get Plus Essential — ₹4,000 / month · Instant access
              </Link>
            </Button>
            <Button
              asChild
              variant="ghost-dark"
              size="lg"
              className="w-full sm:w-auto"
            >
              <Link
                href={`/onboarding/welcome?plan=${plan.id}&cycle=annual`}
                onClick={() =>
                  track("cta_clicked", {
                    location: "final_cta",
                    label: "get_annual",
                  })
                }
              >
                Annual plan — includes Career Services — ₹44,000 / year
              </Link>
            </Button>
          </div>

          {/* Trust strip — guarantee first, then supporting reassurances */}
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-green-100">
            {[
              guarantee.label,
              "Cancel before your next cycle",
              "Instant access",
              "Secure payment",
            ].map((item) => (
              <li key={item} className="inline-flex items-center gap-1.5">
                <Check
                  size={14}
                  weight="bold"
                  className="text-green-500"
                  aria-hidden
                />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
