import { Check, Coins, Gift } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { SectionHeader } from "@/components/marketing/SectionHeader";
import { Badge } from "@/components/ui/Badge";
import { plans, annualSavingsPercent } from "@/lib/data/plans";

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

/**
 * Monthly vs annual — the two things that actually change between billing
 * cycles. The core membership (courses, live Q&A, community, insights, jobs
 * feed) is identical on both, so this section only surfaces the deltas:
 * price/savings, and the Career Services bundle that's free on annual.
 *
 * (File is still named `ValueProps` for backwards-compat with the marketing
 * route imports.)
 */
export function ValueProps() {
  const plan = plans[0];
  const yearlySaving = plan.priceMonthly * 12 - plan.priceAnnualTotal;
  // Career Services is the annual-only delta. Drop the add-ons line — those
  // cost extra on both plans, so they aren't part of what annual unlocks free.
  const careerServices = plan.careerServices.filter(
    (item) => !item.includes("add-ons"),
  );

  return (
    <section className="bg-section-fade py-24 md:py-28">
      <Container width="wide">
        <SectionHeader
          label="Monthly vs annual"
          title={
            <>
              Same membership.{" "}
              <span className="text-green-700">Two things change.</span>
            </>
          }
          description="Every course, live session, the community, weekly insights and the jobs feed come with both plans. Going annual changes exactly two things — what you pay, and whether Career Services is included."
          align="center"
          className="text-center"
        />

        <div className="mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2">
          {/* Difference 1 — what you pay */}
          <div className="flex flex-col rounded-[20px] border border-gray-200 bg-white p-8">
            <div className="grid size-11 place-items-center rounded-full border-[2.5px] border-green-500 bg-white">
              <Coins
                size={20}
                weight="duotone"
                className="text-green-700"
                aria-hidden
              />
            </div>
            <h3 className="mt-6 text-[18px] font-bold leading-tight text-ink">
              What you pay
            </h3>

            <div className="mt-6 grid grid-cols-2 gap-4">
              <div className="rounded-sm bg-gray-50 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-gray-500">
                  Monthly
                </p>
                <p className="mt-2 font-numeral text-[28px] leading-none text-ink">
                  {formatINR(plan.priceMonthly)}
                </p>
                <p className="mt-1 text-[13px] text-gray-500">/ month</p>
              </div>
              <div className="rounded-sm bg-green-100 p-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-green-700">
                  Annual
                </p>
                <p className="mt-2 font-numeral text-[28px] leading-none text-green-700">
                  {formatINR(plan.priceAnnual)}
                </p>
                <p className="mt-1 text-[13px] text-gray-600">
                  / mo · {formatINR(plan.priceAnnualTotal)} billed once
                </p>
              </div>
            </div>

            <p className="mt-6 text-[15px] leading-relaxed text-gray-700">
              Annual saves{" "}
              <span className="font-semibold text-ink">
                {annualSavingsPercent}%
              </span>{" "}
              — that&apos;s {formatINR(yearlySaving)} a year, roughly two months
              free.
            </p>
          </div>

          {/* Difference 2 — Career Services (annual only) */}
          <div className="relative flex flex-col rounded-[20px] border border-green-700 bg-white p-8 shadow-lift">
            <span className="absolute -top-3 left-8">
              <Badge tone="neon">Annual only</Badge>
            </span>
            <div className="grid size-11 place-items-center rounded-full border-[2.5px] border-green-500 bg-white">
              <Gift
                size={20}
                weight="duotone"
                className="text-green-700"
                aria-hidden
              />
            </div>
            <h3 className="mt-6 text-[18px] font-bold leading-tight text-ink">
              Career Services — free on annual
            </h3>
            <p className="mt-2 text-[15px] leading-relaxed text-gray-700">
              A {formatINR(plan.careerServicesValue)} bundle, included at no
              extra cost when you go annual. Not part of the monthly plan.
            </p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {careerServices.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-[14px] text-ink"
                >
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-green-500">
                    <Check size={12} weight="bold" className="text-teal-900" />
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <p className="mx-auto mt-10 max-w-2xl text-center text-[15px] leading-relaxed text-gray-500">
          Everything else is identical — all {plan.coursesLive.length} courses,
          bi-weekly live Q&amp;A, the 40,000+ community, weekly insights and the
          curated jobs feed come with both plans.
        </p>
      </Container>
    </section>
  );
}
