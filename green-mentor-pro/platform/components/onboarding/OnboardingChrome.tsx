"use client";

import { usePathname } from "next/navigation";
import { Container } from "@/components/marketing/Container";
import { Logo, SubBrand } from "@/components/marketing/Logo";
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
          <div className="flex items-center gap-3">
            <Logo variant="dark" />
            <span className="block h-5 w-px bg-white/20" aria-hidden />
            <SubBrand className="text-green-100" />
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
