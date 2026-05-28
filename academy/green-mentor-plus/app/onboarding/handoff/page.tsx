"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding } from "@/lib/store/onboarding";
import { buildHandoffUrl } from "@/lib/learnyst/client";
import { plans } from "@/lib/data/plans";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/utils/analytics";
import { syncLead } from "@/lib/lead/sync";

const SPINNER_MS = 1200;

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function HandoffStep() {
  const router = useRouter();
  const name = useOnboarding((s) => s.name);
  const planId = useOnboarding((s) => s.planId);
  const billingCycle = useOnboarding((s) => s.billingCycle);
  const paymentStatus = useOnboarding((s) => s.paymentStatus);

  const plan = planId ? plans.find((p) => p.id === planId) ?? null : null;
  const totalRupees = plan
    ? billingCycle === "annual"
      ? plan.priceAnnualTotal
      : plan.priceMonthly
    : 0;

  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);
  const [phase, setPhase] = useState<"loading" | "redirecting" | "fallback">(
    "loading",
  );
  const [hydrated, setHydrated] = useState(false);
  const ranRef = useRef(false);

  // Wait for the persisted store to rehydrate before checking paymentStatus —
  // otherwise the guard fires against the default `idle` state and we bounce
  // back to /checkout on first paint.
  useEffect(() => {
    if (useOnboarding.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    const unsub = useOnboarding.persist.onFinishHydration(() =>
      setHydrated(true),
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (ranRef.current) return;
    // Guard: only run the handoff after Razorpay payment has been verified.
    if (paymentStatus !== "paid") {
      router.replace("/onboarding/checkout");
      return;
    }
    ranRef.current = true;

    const state = useOnboarding.getState();
    const payload = {
      name: state.name,
      email: state.email,
      segment: state.segment,
      planId: state.planId,
      goals: state.goals,
    };

    const url = buildHandoffUrl(payload);
    setRedirectUrl(url);

    track("handoff_initiated", {
      segment: payload.segment,
      planId: payload.planId,
      goals: payload.goals.length,
    });

    // Finalize the lead row: paymentStatus is "paid" here, so syncLead marks
    // it "completed" with the Razorpay subscription + payment ids.
    syncLead("handoff");

    const showSuccess = window.setTimeout(() => {
      setPhase("redirecting");
      window.setTimeout(() => {
        window.location.assign(url);
        window.setTimeout(() => setPhase("fallback"), 4000);
      }, 350);
    }, SPINNER_MS);

    return () => window.clearTimeout(showSuccess);
  }, [hydrated, paymentStatus, router]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="grid place-items-center py-16 text-center"
    >
      {phase === "loading" ? (
        <>
          <span
            aria-hidden
            className="size-14 animate-spin rounded-full border-2 border-green-500/30 border-t-green-500"
          />
          <h1 className="font-display mt-8 text-[28px] leading-tight tracking-[-0.02em] text-white md:text-[40px]">
            Activating your membership…
          </h1>
          <p className="mt-4 max-w-md text-[16px] text-white/80">
            Payment confirmed. We&apos;re passing you to Learnyst with your
            preferences pre-filled.
          </p>
        </>
      ) : (
        <>
          <span className="grid size-14 place-items-center rounded-full bg-green-500">
            <CheckCircle
              size={36}
              weight="fill"
              className="text-teal-900"
              aria-hidden
            />
          </span>
          <h1 className="font-display mt-6 text-[28px] leading-tight tracking-[-0.02em] text-white md:text-[40px]">
            You&apos;re set, {name.split(" ")[0] || "friend"}.
          </h1>
          <p className="mt-4 max-w-md text-[16px] text-white/80">
            Your membership is active.{" "}
            {phase === "redirecting"
              ? "Redirecting you to Learnyst to start learning…"
              : "If you weren't redirected automatically, use the button below."}
          </p>

          {plan ? (
            <div className="mt-8 w-full max-w-sm rounded-[16px] border border-gray-200 bg-white p-6 text-left">
              <h2 className="text-[12px] font-semibold tracking-wide text-green-700 uppercase">
                Order summary
              </h2>
              <dl className="mt-4 grid gap-3 text-[14px]">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-gray-500">Plan</dt>
                  <dd className="text-right font-medium text-ink">
                    {plan.name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-gray-500">Billing</dt>
                  <dd className="text-ink">
                    {billingCycle === "annual" ? "Annual" : "Monthly"}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-gray-200 pt-3">
                  <dt className="font-semibold text-ink">Total</dt>
                  <dd className="font-semibold text-ink">
                    {formatINR(totalRupees)}{" "}
                    <span className="font-normal text-gray-500">
                      {billingCycle === "annual" ? "/ year" : "/ month"}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          ) : null}

          {redirectUrl ? (
            <Button
              asChild
              variant="primary"
              size="lg"
              className="mt-8"
              iconRight={<ArrowRight size={18} weight="bold" />}
            >
              <Link href={redirectUrl}>Continue on Learnyst</Link>
            </Button>
          ) : null}

          <Link
            href="/"
            className="mt-6 text-[14px] text-white/60 underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </>
      )}
    </motion.div>
  );
}
