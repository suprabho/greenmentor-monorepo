"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Container } from "@/components/marketing/Container";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/utils/analytics";

/**
 * Email capture for visitors who don't convert (G-5) — "Get the free ESG Career
 * Roadmap." Posts to the existing /api/lead sink (Google Sheet). Rendered as an
 * inline band; wire it to an exit-intent trigger or a sticky bottom bar when you
 * want the popup behaviour.
 *
 * SCAFFOLD — before enabling in the page:
 *   TODO[asset]: create + deliver the actual "ESG Career Roadmap" (the email
 *     follow-up / PDF). Right now submitting only records the lead.
 *   TODO[product]: decide the trigger (exit-intent vs sticky bar) and whether to
 *     also collect a name. /api/lead requires name+email, so we derive a name
 *     from the email local-part below as a stop-gap.
 */
export function RoadmapCapture() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "loading") return;
    setState("loading");
    const local = email.split("@")[0] ?? "";
    const name = local.length >= 2 ? local : "Roadmap subscriber";
    try {
      const res = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, step: "roadmap-capture" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      track("cta_clicked", { location: "roadmap_capture", label: "submit" });
      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="bg-section-fade py-16">
      <Container width="default">
        <div className="rounded-[20px] border border-gray-200 bg-white p-8 text-center shadow-soft md:p-10">
          <h2 className="font-display text-[24px] leading-tight text-ink md:text-[30px]">
            Not ready to subscribe yet?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-[16px] leading-relaxed text-gray-700">
            Get our free ESG Career Roadmap — the 5 skills that get you hired at
            EY, KPMG, and India&apos;s top sustainability teams.
          </p>

          {state === "done" ? (
            <p className="mt-6 text-[15px] font-semibold text-green-700">
              Done — check your inbox for the roadmap.
            </p>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row"
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                aria-label="Email address"
                className="h-12 flex-1 rounded-[10px] border border-gray-200 px-4 text-[15px] text-ink outline-none focus:border-green-700"
              />
              <Button
                type="submit"
                variant="primary"
                size="md"
                loading={state === "loading"}
                iconRight={<ArrowRight size={16} weight="bold" />}
              >
                Send me the roadmap
              </Button>
            </form>
          )}
          {state === "error" ? (
            <p className="mt-3 text-[13px] text-danger">
              Something went wrong — please try again.
            </p>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
