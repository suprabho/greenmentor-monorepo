"use client";

import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { audiences } from "@/lib/data/audiences";
import { track } from "@/lib/utils/analytics";

export function AudienceSelector() {
  return (
    <section id="audience" className="bg-section-fade py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="Who it's for"
          title={
            <>
              Three paths into ESG.{" "}
              <span className="text-green-700">One membership.</span>
            </>
          }
          description="We segment the library by where you are today — so you don't pay for what you won't use."
        />

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          {audiences.map((audience) => {
            const Icon = audience.icon;
            return (
              <Link
                key={audience.id}
                href={`/onboarding/intro?segment=${audience.id}`}
                onClick={() =>
                  track("audience_card_clicked", { segment: audience.id })
                }
                className="group relative flex flex-col rounded-[20px] border border-gray-200 bg-white p-8 transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-green-700 hover:shadow-lift"
              >
                <div className="grid size-12 place-items-center rounded-full border-[2.5px] border-green-500 bg-white">
                  <div className="size-6 rounded-full bg-green-500" />
                </div>

                <h3 className="mt-8 text-[24px] font-bold leading-tight text-ink">
                  {audience.label}
                </h3>
                <p className="mt-2 text-[16px] font-medium text-green-700">
                  {audience.tagline}
                </p>
                <p className="mt-5 flex-1 text-[16px] leading-relaxed text-gray-700">
                  {audience.description}
                </p>

                <span className="mt-8 inline-flex items-center gap-2 text-[15px] font-semibold text-green-700">
                  {audience.cta}
                  <ArrowUpRight
                    size={16}
                    weight="bold"
                    className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  />
                </span>

                {/* Custom Icon (e.g. user persona) — secondary */}
                <Icon
                  size={20}
                  weight="duotone"
                  className="absolute top-8 right-8 text-gray-400"
                  aria-hidden
                />
              </Link>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
