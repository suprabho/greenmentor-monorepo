import type { SupabaseClient } from "@supabase/supabase-js";
import { daysBetween, kolkataDateString } from "./time";

// Admin-client only — import this exclusively from API routes
// (app/api/academy/**), never from a Server Component rendering a page for
// the signed-in user. This is the surface that actually writes XP/coins/
// streaks, so it must never run with the caller's own (spoofable) session.

// PRD §8.2 earning schedule. Module-gate xp/coin values come from
// assessments.xp_award / coin_award (so future authored content can tune
// them per assessment), not hardcoded here. The weekly-challenge row
// (+100 XP / +500 coins) has no corresponding feature built this pass and is
// intentionally omitted.
export const AWARDS = {
  lessonCompleted: { xp: 10, coins: 2 },
  courseCompleted: { xp: 100, coins: 100 },
  perfectAssessment: { xp: 15, coins: 0 },
  streakMilestone: { xp: 50, coins: 50 },
} as const;

const STREAK_MILESTONES = new Set([7, 30, 100]);
const POSTGRES_UNIQUE_VIOLATION = "23505";

export type AwardResult = { xpAwarded: number; coinsAwarded: number };

/**
 * Insert an xp_events row (and, if coins > 0, a matching credit_transactions
 * row) keyed by `eventRef`. Both tables have a UNIQUE(user_id, ref) — a
 * repeat call with the same ref hits that constraint and awards nothing,
 * which is the idempotency guarantee FR-G-06 requires.
 */
export async function awardIdempotent(
  admin: SupabaseClient,
  userId: string,
  args: { eventType: string; eventRef: string; xp: number; coins: number }
): Promise<AwardResult> {
  const { data: xpRow, error: xpErr } = await admin
    .from("xp_events")
    .insert({ user_id: userId, event_type: args.eventType, event_ref: args.eventRef, xp: args.xp })
    .select("id")
    .maybeSingle();
  if (xpErr && xpErr.code !== POSTGRES_UNIQUE_VIOLATION) throw new Error(xpErr.message);
  const xpAwarded = xpRow ? args.xp : 0;

  let coinsAwarded = 0;
  if (args.coins > 0) {
    const { data: coinRow, error: coinErr } = await admin
      .from("credit_transactions")
      .insert({ user_id: userId, type: "earn", amount: args.coins, ref: args.eventRef, description: args.eventType })
      .select("id")
      .maybeSingle();
    if (coinErr && coinErr.code !== POSTGRES_UNIQUE_VIOLATION) throw new Error(coinErr.message);
    coinsAwarded = coinRow ? args.coins : 0;
  }

  return { xpAwarded, coinsAwarded };
}

/**
 * Once/day streak accounting (PRD §8.3, Asia/Kolkata). Same-day re-entry is a
 * no-op; a one-day gap increments; any larger gap resets to 1. Crossing a
 * 7/30/100 milestone awards the bonus exactly once via awardIdempotent.
 */
export async function touchStreak(
  admin: SupabaseClient,
  userId: string
): Promise<{ currentLen: number; milestoneAward: AwardResult | null }> {
  const today = kolkataDateString();

  const { data: existing, error: fetchErr } = await admin
    .from("streaks")
    .select("current_len, longest_len, last_active_date")
    .eq("user_id", userId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  const alreadyCountedToday = existing?.last_active_date === today;

  let currentLen: number;
  if (!existing || !existing.last_active_date) {
    currentLen = 1;
  } else if (alreadyCountedToday) {
    currentLen = existing.current_len;
  } else {
    const gap = daysBetween(existing.last_active_date, today);
    currentLen = gap === 1 ? existing.current_len + 1 : 1;
  }
  const longestLen = Math.max(currentLen, existing?.longest_len ?? 0);

  const { error: upsertErr } = await admin.from("streaks").upsert(
    {
      user_id: userId,
      current_len: currentLen,
      longest_len: longestLen,
      last_active_date: today,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertErr) throw new Error(upsertErr.message);

  let milestoneAward: AwardResult | null = null;
  if (!alreadyCountedToday && STREAK_MILESTONES.has(currentLen)) {
    milestoneAward = await awardIdempotent(admin, userId, {
      eventType: "streak_milestone",
      eventRef: `streak:${currentLen}:${today}`,
      xp: AWARDS.streakMilestone.xp,
      coins: AWARDS.streakMilestone.coins,
    });
  }

  return { currentLen, milestoneAward };
}

export function awardLessonCompletion(admin: SupabaseClient, userId: string, lessonId: string) {
  return awardIdempotent(admin, userId, {
    eventType: "lesson_completed",
    eventRef: `lesson:${lessonId}`,
    xp: AWARDS.lessonCompleted.xp,
    coins: AWARDS.lessonCompleted.coins,
  });
}

export async function awardAssessmentPass(
  admin: SupabaseClient,
  userId: string,
  assessmentId: string,
  xp: number,
  coins: number,
  perfect: boolean
): Promise<AwardResult> {
  const pass = await awardIdempotent(admin, userId, {
    eventType: "module_gate_passed",
    eventRef: `assessment:${assessmentId}`,
    xp,
    coins,
  });
  if (!perfect) return pass;

  const bonus = await awardIdempotent(admin, userId, {
    eventType: "perfect_assessment",
    eventRef: `assessment:${assessmentId}:perfect`,
    xp: AWARDS.perfectAssessment.xp,
    coins: AWARDS.perfectAssessment.coins,
  });
  return { xpAwarded: pass.xpAwarded + bonus.xpAwarded, coinsAwarded: pass.coinsAwarded + bonus.coinsAwarded };
}

export function awardCourseCompletion(admin: SupabaseClient, userId: string, courseId: string) {
  return awardIdempotent(admin, userId, {
    eventType: "course_completed",
    eventRef: `course:${courseId}`,
    xp: AWARDS.courseCompleted.xp,
    coins: AWARDS.courseCompleted.coins,
  });
}
