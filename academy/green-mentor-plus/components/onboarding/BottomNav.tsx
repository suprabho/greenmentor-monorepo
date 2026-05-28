"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Button } from "@/components/ui/Button";

interface BottomNavProps {
  backHref?: string;
  onBack?: () => void;
  onContinue?: () => void;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
}

export function BottomNav({
  backHref,
  onBack,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  continueLoading = false,
}: BottomNavProps) {
  return (
    <div className="sticky bottom-0 z-30 -mx-6 mt-auto flex flex-col-reverse gap-3 border-t border-white/10 bg-teal-900/85 px-6 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between md:-mx-8 md:px-8">
      {backHref ? (
        <Button
          asChild
          variant="ghost-dark"
          size="md"
          iconLeft={<ArrowLeft size={16} />}
        >
          <Link href={backHref}>Back</Link>
        </Button>
      ) : onBack ? (
        <Button
          variant="ghost-dark"
          size="md"
          onClick={onBack}
          iconLeft={<ArrowLeft size={16} />}
        >
          Back
        </Button>
      ) : (
        <span />
      )}

      <Button
        variant="primary"
        size="lg"
        onClick={onContinue}
        disabled={continueDisabled}
        loading={continueLoading}
        iconRight={!continueLoading ? <ArrowRight size={18} weight="bold" /> : undefined}
      >
        {continueLabel}
      </Button>
    </div>
  );
}
