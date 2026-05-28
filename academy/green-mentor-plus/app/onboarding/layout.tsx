"use client";

import { usePathname } from "next/navigation";
import { Container } from "@/components/marketing/Container";
import { Logo, SubBrand } from "@/components/marketing/Logo";
import { ProgressBar } from "@/components/onboarding/ProgressBar";

const stepOrder = [
  "/onboarding/welcome",
  "/onboarding/audience",
  "/onboarding/goals",
  "/onboarding/plan",
  "/onboarding/checkout",
  "/onboarding/handoff",
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const totalSteps = stepOrder.length - 1;
  const currentIndex = stepOrder.findIndex((p) => pathname?.startsWith(p));
  const step = Math.min(totalSteps, Math.max(1, currentIndex + 1));
  // Hide the progress bar on the handoff step — it's a terminal screen, not
  // a stop along the path.
  const isHandoff = pathname?.startsWith("/onboarding/handoff");
  // The intro is a pre-flow tour, not a numbered step — hide the progress bar.
  const isIntro = pathname?.startsWith("/onboarding/intro");
  const hideProgress = isHandoff || isIntro;

  return (
    <div className="flex min-h-screen flex-col bg-section-fade">
      <header className="border-b border-gray-200 bg-white">
        <Container width="wide">
          <div className="flex h-[72px] items-center justify-between gap-6 md:h-20">
            <div className="flex items-center gap-3">
              <Logo />
              <span
                className="hidden h-5 w-px bg-gray-200 sm:block"
                aria-hidden
              />
              <SubBrand className="hidden sm:inline" />
            </div>
            {!hideProgress ? (
              <div className="hidden w-64 sm:block">
                <ProgressBar step={step} total={totalSteps} />
              </div>
            ) : null}
          </div>
          {!hideProgress ? (
            <div className="pb-4 sm:hidden">
              <ProgressBar step={step} total={totalSteps} />
            </div>
          ) : null}
        </Container>
      </header>

      <main className="flex-1 py-12 md:py-20">
        <Container width="narrow">{children}</Container>
      </main>
    </div>
  );
}
