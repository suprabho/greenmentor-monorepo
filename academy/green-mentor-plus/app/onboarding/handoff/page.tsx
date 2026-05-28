"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { useOnboarding } from "@/lib/store/onboarding";
import { buildHandoffUrl } from "@/lib/learnyst/client";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/utils/analytics";

const SPINNER_MS = 1200;

export default function HandoffStep() {
  const router = useRouter();
  const name = useOnboarding((s) => s.name);
  const paymentStatus = useOnboarding((s) => s.paymentStatus);

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

    fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        billingCycle: state.billingCycle,
        razorpaySubscriptionId: state.razorpaySubscriptionId,
        razorpayPaymentId: state.razorpayPaymentId,
      }),
      keepalive: true,
    }).catch(() => {
      // best-effort
    });

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
          <h1 className="font-display mt-8 text-[28px] leading-tight tracking-[-0.02em] text-ink md:text-[40px]">
            Activating your membership…
          </h1>
          <p className="mt-4 max-w-md text-[16px] text-gray-700">
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
          <h1 className="font-display mt-6 text-[28px] leading-tight tracking-[-0.02em] text-ink md:text-[40px]">
            You&apos;re set, {name.split(" ")[0] || "friend"}.
          </h1>
          <p className="mt-4 max-w-md text-[16px] text-gray-700">
            {phase === "redirecting"
              ? "Redirecting you to Learnyst to start learning…"
              : "If you weren't redirected automatically, use the button below."}
          </p>
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
            className="mt-6 text-[14px] text-gray-500 underline-offset-4 hover:underline"
          >
            Back to home
          </Link>
        </>
      )}
    </motion.div>
  );
}
