"use client";

import { useRouter } from "next/navigation";
import { ThumbsUp, ChatCircle, LinkSimple } from "@phosphor-icons/react";
import { Card, Chip, ProgressBar } from "@/components/ui";
import { ArticleImage } from "@/components/feed/article-image";
import { ChatComposer } from "@/components/ai-hub/ChatComposer";
import { SuggestionChips } from "@/components/ai-hub/SuggestionChips";
import { CHAT_SKILLS } from "@/components/ai-hub/skills";

/**
 * Fallback cards for the single-fold carousel landing.
 *
 * The feed, academy and jobs slides render the real in-app components with
 * real rows (see lib/marketing/landing-samples.ts); the static replicas here
 * only appear when a sample can't be read — an empty table, a migration not
 * yet applied — so the fold never shows a hole. The AI Hub card is the one
 * that's always this file's: it composes the real composer and chips, but
 * routes a signed-out visitor to sign-in instead of creating a conversation.
 * Shared primitives (Card, Chip, ProgressBar, ArticleImage) are the real ones,
 * so chrome, chip tones, radii and shadows track the design system.
 *
 * Sizing is fluid: mobile values first, desktop clamps at `md` and up.
 */

/** Shared card body padding — 16px on a phone, fluid up to 22px on desktop. */
const CARD_PAD = "p-4 md:p-[clamp(16px,2vw,22px)]";

/** Sample headline/body sizing shared by the feed, academy and jobs titles. */
const CARD_TITLE = "text-[16px] font-semibold text-ink md:text-[clamp(15px,1.2vw,17px)]";

/* ------------------------------------------------------------------ 01 Feed */

/**
 * Read-only twin of `FeedItemActions`. Same pill geometry and icon set; the
 * counts are static and nothing is clickable.
 */
function FeedActionsPreview() {
  const pill =
    "inline-flex items-center gap-1.5 rounded-pill px-2.5 py-1 text-[13px] font-semibold tabular-nums";
  return (
    <div className="flex items-center gap-0.5 border-t border-gray-100 pt-2.5">
      <span className={`${pill} text-teal-800`}>
        <ThumbsUp size={17} weight="fill" />
        128
      </span>
      <span className={`${pill} text-gray-500`}>
        <ChatCircle size={17} />
        34
      </span>
      <span className={`${pill} ml-auto text-gray-500`}>
        <LinkSimple size={17} />
        Copy link
      </span>
    </div>
  );
}

export function FeedCardPreview() {
  return (
    <Card className="overflow-hidden">
      {/* No publisher image on purpose: this is ArticleImage's branded gradient
          fallback, which is what most feed cards actually render. */}
      <ArticleImage
        src={null}
        source="SEBI"
        className="aspect-[16/9] w-full max-h-[150px] md:max-h-[min(128px,14vh)]"
      />
      <div className={`flex flex-col gap-[9px] md:gap-2.5 ${CARD_PAD}`}>
        <div className="flex items-center gap-2 text-[12px] text-gray-500">
          <span className="rounded-pill bg-gray-100 px-2 py-0.5 font-semibold text-gray-700">
            SEBI
          </span>
          <span>2h ago</span>
        </div>

        <h3 className={`${CARD_TITLE} leading-[1.35]`}>
          BRSR Core assurance widened to the top 1,000 listed companies
        </h3>

        <p className="text-[13.5px] leading-[1.5] text-gray-700">
          Value-chain disclosures stay comply-or-explain for another year, with
          reasonable assurance phased in by market cap.
        </p>

        <div className="flex flex-wrap gap-1.5 md:pt-0.5">
          <Chip tone="teal">BRSR</Chip>
          <Chip tone="green">Reporting</Chip>
          <Chip tone="neutral">+2 more</Chip>
        </div>

        <FeedActionsPreview />
      </div>
    </Card>
  );
}

/* --------------------------------------------------------------- 02 Academy */

export function CourseCardPreview() {
  return (
    <Card className="overflow-hidden">
      <div className="h-24 bg-gradient-to-br from-teal-900 via-teal-800 to-green-700 md:h-[clamp(90px,12vw,130px)]" />
      <div className={`flex flex-col ${CARD_PAD}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Chip tone="green">Free</Chip>
          <Chip tone="teal">beginner</Chip>
        </div>

        <p className={`mt-3 md:mt-3.5 ${CARD_TITLE}`}>ESG Fundamentals</p>
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-gray-600 md:text-[13px]">
          What ESG is, who asks for it, and how a disclosure comes together.
        </p>
        <p className="mt-2.5 text-[11.5px] font-semibold text-gray-500">
          6 modules · 24 lessons · ~3h 10m
        </p>

        <div className="pt-4 md:pt-[18px]">
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-semibold text-gray-700">
            <span>In progress</span>
            <span>68%</span>
          </div>
          <ProgressBar value={68} />
        </div>
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- 03 AI Hub */

/**
 * The AI Hub welcome state, built from the real composer and suggestion chips
 * rather than a drawing of them. Unlike `ChatWelcome` it never creates a
 * conversation: a marketing visitor is signed out, so a send or a picked chip
 * carries them to sign-in and on to the chat, where the real welcome takes
 * over. The chips fetch /api/ai-hub/chat/suggestions like they do in-app and
 * keep their defaults when that 401s.
 */
export function ChatWelcomePreview() {
  const router = useRouter();
  const goSignIn = () => router.push("/login?next=/ai-hub/chat");

  return (
    <Card className="flex flex-col justify-center p-[18px] md:p-[clamp(18px,2.2vw,26px)]">
      <p className="font-display text-center text-[20px] text-ink md:text-[clamp(20px,2vw,26px)]">
        Welcome to the AI Hub
      </p>
      <div className="mt-4 md:mt-5">
        <ChatComposer
          onSend={goSignIn}
          placeholder="How can I help with your ESG reporting?"
          skills={CHAT_SKILLS}
        />
      </div>
      <div className="mt-3.5 md:mt-4">
        <SuggestionChips onPick={goSignIn} />
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ 04 Jobs */

export function JobCardPreview() {
  return (
    <Card className="p-4 md:p-[clamp(18px,2vw,22px)]">
      <div className="flex flex-wrap items-start gap-3 md:gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-teal-900 text-[13px] font-bold text-green-500">
          TA
        </span>

        <div className="min-w-0 flex-1 md:min-w-[200px]">
          <div className="flex flex-wrap items-center gap-2">
            <p className={`${CARD_TITLE} tracking-[-0.01em]`}>ESG Reporting Analyst</p>
            <Chip tone="neutral">Full-time</Chip>
          </div>
          <p className="mt-[3px] text-[13px] text-gray-700">Tata Group</p>
          <p className="mt-1.5 text-[12px] font-medium text-gray-600">
            Mumbai, India · 2–4 years
            <span className="hidden md:inline"> · 14 Aug 2026</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Chip tone="green">BRSR</Chip>
            <Chip tone="green">GRI</Chip>
            <Chip tone="green">Assurance</Chip>
          </div>
        </div>

        {/* Phone: a full-width footer under a hairline. Desktop: a right-hand
            rail beside the detail column, matching the real JobCard reflow. */}
        <div className="mt-3.5 flex w-full shrink-0 items-center justify-between gap-3 border-t border-gray-200 pt-3.5 md:mt-0 md:w-auto md:flex-col md:items-start md:justify-start md:gap-2.5 md:border-0 md:pt-0">
          <span className="text-[12.5px] font-semibold whitespace-nowrap text-teal-800">
            ₹12–18 LPA
          </span>
          <span className="inline-flex min-h-11 items-center justify-center rounded-pill bg-teal-900 px-[22px] text-[13px] font-semibold whitespace-nowrap text-white md:min-h-0 md:px-[18px] md:py-2 md:text-[12.5px]">
            Apply
          </span>
        </div>
      </div>
    </Card>
  );
}
