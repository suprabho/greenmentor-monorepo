"use client";

import { usePathname } from "next/navigation";
import { Leaf } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { Logo } from "@/components/marketing/Logo";
import { ProgressBar } from "@/components/onboarding/ProgressBar";
import { ONBOARDING_STEPS } from "@/lib/onboarding/steps";

/**
 * Header chrome for the onboarding shell. Client-side because the step index
 * comes from the pathname — the layout that wraps it stays a Server Component
 * so it can do the auth + profile read.
 */
export function OnboardingChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const total = ONBOARDING_STEPS.length;
  const index = ONBOARDING_STEPS.findIndex((p) => pathname.startsWith(p));
  const step = Math.min(total, Math.max(1, index + 1));

  return (
    <main className="flex flex-1 flex-col overflow-y-auto">
      <Container width="wide" className="flex-none">
        <div className="flex h-18 items-center justify-between gap-6 md:h-20">
          {/* The Pro lockup from the app sidebar (components/shell.tsx), not the
              Plus sub-brand. Deliberately not a link — the user is mid-flow and
              the onboarding gate would bounce them straight back anyway. */}
          <div className="flex items-center gap-2.5" aria-label="Green Mentor Pro">
            <span className="grid size-9 shrink-0 place-items-center rounded-[6px] bg-green-500 text-teal-900">
              <Leaf size={20} weight="fill" />
            </span>
            <span className="leading-tight whitespace-nowrap">
              <Logo bare variant="dark" className="block h-5" />
              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-[0.18em] text-green-500">
                Pro
              </span>
            </span>
          </div>
          <div className="hidden w-64 sm:block">
            <ProgressBar step={step} total={total} />
          </div>
        </div>
        <div className="pb-4 sm:hidden">
          <ProgressBar step={step} total={total} />
        </div>
      </Container>

      <Container width="default" className="flex min-h-full flex-col pb-2">
        {children}
      </Container>
    </main>
  );
}
