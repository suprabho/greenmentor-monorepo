// Connects AI usage to the shared credits ledger (public.credit_transactions,
// created in 0008_academy_gamification.sql).
//
// Two entry points, one before the model call and one after:
//   checkAiAllowance() — free-allowance check, then a balance floor. Returns
//                        allowed:false when the caller should be refused (402).
//   recordAiUsage()    — writes the ai_usage_events row and, when charging is on,
//                        the matching ledger spend.
//
// Server-only (imports the Supabase server/admin clients). Import from API routes,
// server actions, or Server Components — never from client code. The surface
// constants live in ./surfaces so UI can import those without this module.
//
// Pricing is metered from real tokens, so the exact credit cost is unknowable
// before the call runs. `MIN_BALANCE_CREDITS` is the stand-in for a pre-run price:
// a plausible worst case for the surface that the balance must clear.

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { kolkataDateString } from "@/lib/academy/time";
import { chargeableCredits, priceUsage, type PricedUsage } from "./pricing";
import { AI_SURFACES, FREE_DAILY_CALLS, MIN_BALANCE_CREDITS, type AiSurface } from "./surfaces";
import type { LanguageModelUsage } from "ai";

/**
 * Master switch. While OFF (the default) usage is still recorded in full, but no
 * ledger row is written and nobody is ever refused — so real cost data accumulates
 * before prices bite. Flip AI_CREDITS_ENFORCED=true once the rate table and
 * margin have been validated against observed spend.
 */
export function creditsEnforced(): boolean {
  return process.env.AI_CREDITS_ENFORCED === "true";
}

/**
 * Start of today in Asia/Kolkata as a timestamptz literal. IST is a fixed +05:30
 * with no DST, so the offset can be appended literally.
 */
function kolkataDayStart(): string {
  return `${kolkataDateString()}T00:00:00+05:30`;
}

export interface AiAllowance {
  /** False only when enforcement is on and the balance is below the surface floor. */
  allowed: boolean;
  /** This call falls inside the free daily allowance — record it, never charge it. */
  freeTier: boolean;
  enforced: boolean;
  balance: number;
  freeUsedToday: number;
  freeAllowance: number;
  /** Set when allowed is false, for the message the caller returns. */
  reason?: "insufficient_credits";
}

/** Sum the ledger. Cheap while the ledger is small (same assumption as 0008). */
async function creditBalance(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<number> {
  const { data, error } = await admin.from("credit_transactions").select("amount").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).reduce((sum, row) => sum + row.amount, 0);
}

/**
 * Decide whether a user may make an AI call on this surface, and whether it should
 * be free. Call this BEFORE the model runs.
 *
 * Fails open: if the check itself errors (DB down, missing migration) the call is
 * allowed and treated as free rather than blocking the product on a billing read.
 */
export async function checkAiAllowance(userId: string, surface: AiSurface): Promise<AiAllowance> {
  const enforced = creditsEnforced();
  const freeAllowance = FREE_DAILY_CALLS[surface];

  try {
    const admin = createAdminClient();
    const { count, error } = await admin
      .from("ai_usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("surface", surface)
      .gte("created_at", kolkataDayStart());
    if (error) throw new Error(error.message);

    const freeUsedToday = count ?? 0;
    if (freeUsedToday < freeAllowance) {
      return { allowed: true, freeTier: true, enforced, balance: 0, freeUsedToday, freeAllowance };
    }

    // Past the allowance: metered from here. Only look up the balance now — an
    // unenforced deployment never needs it, and neither does a free-tier call.
    if (!enforced) {
      return { allowed: true, freeTier: false, enforced, balance: 0, freeUsedToday, freeAllowance };
    }

    const balance = await creditBalance(admin, userId);
    if (balance < MIN_BALANCE_CREDITS[surface]) {
      return {
        allowed: false,
        freeTier: false,
        enforced,
        balance,
        freeUsedToday,
        freeAllowance,
        reason: "insufficient_credits",
      };
    }
    return { allowed: true, freeTier: false, enforced, balance, freeUsedToday, freeAllowance };
  } catch (err) {
    console.error(`[ai/usage] allowance check failed for ${surface}; allowing as free:`, err);
    return { allowed: true, freeTier: true, enforced, balance: 0, freeUsedToday: 0, freeAllowance };
  }
}

export interface RecordUsageArgs {
  userId: string;
  orgId?: string | null;
  surface: AiSurface;
  /** Conversation / engagement id etc, so a row can be traced back to its cause. */
  ref?: string | null;
  /** Model id as reported by the provider. */
  model: string;
  usage: LanguageModelUsage | undefined;
  /** From checkAiAllowance — whether this call was inside the free allowance. */
  freeTier: boolean;
}

/**
 * Record one billable model call, and debit the ledger when charging is on.
 *
 * NEVER THROWS. This runs in a stream's onFinish, after the user already has their
 * answer — a metering bug must not turn a served response into an error. Failures
 * are logged and the row is lost, which is the right trade: an unbilled call beats
 * a broken product.
 *
 * The write order (event first, then ledger, then flip `charged`) is chosen so that
 * a mid-way failure under-charges rather than charging with no audit row.
 */
export async function recordAiUsage(args: RecordUsageArgs): Promise<void> {
  try {
    const priced = priceUsage(args.model, args.usage);

    // Nothing was actually consumed (e.g. a pre-flight refusal short-circuited the
    // model). Skip the row so it doesn't burn free allowance.
    if (priced.inputTokens + priced.cacheReadTokens + priced.outputTokens === 0) return;

    const willCharge = creditsEnforced() && !args.freeTier;
    const credits = chargeableCredits(priced.credits);
    const admin = createAdminClient();

    const { data: event, error: eventErr } = await admin
      .from("ai_usage_events")
      .insert({
        user_id: args.userId,
        org_id: args.orgId ?? null,
        surface: args.surface,
        ref: args.ref ?? null,
        model: priced.model,
        priced: priced.priced,
        input_tokens: priced.inputTokens,
        cache_read_tokens: priced.cacheReadTokens,
        cache_write_tokens: priced.cacheWriteTokens,
        output_tokens: priced.outputTokens,
        reasoning_tokens: priced.reasoningTokens,
        cost_usd: priced.costUsd,
        cost_inr: priced.costInr,
        credits: priced.credits,
        credits_charged: 0,
        free_tier: args.freeTier,
        charged: false,
      })
      .select("id")
      .single();
    if (eventErr) throw new Error(eventErr.message);

    if (priced.priced === "fallback") {
      console.warn(
        `[ai/usage] no rate for model '${priced.model}' — priced at the fallback rate. Update lib/ai/pricing.ts.`,
      );
    }
    if (!willCharge || credits === 0) return;

    // ref is unique per (user_id, ref) in the ledger, so a retry of this block can
    // never double-debit.
    const { error: ledgerErr } = await admin.from("credit_transactions").insert({
      user_id: args.userId,
      type: "spend",
      amount: -credits,
      ref: `ai:${event.id}`,
      description: `ai:${args.surface}`,
    });
    if (ledgerErr) throw new Error(ledgerErr.message);

    const { error: markErr } = await admin
      .from("ai_usage_events")
      .update({ charged: true, credits_charged: credits })
      .eq("id", event.id);
    if (markErr) throw new Error(markErr.message);
  } catch (err) {
    console.error(`[ai/usage] failed to record ${args.surface} usage:`, err);
  }
}

// ── Reads for the wallet UI ─────────────────────────────────────────────────
// These run on the caller's own session (not the admin client): the owner-read RLS
// policies on credit_transactions and ai_usage_events scope them to the user.

export interface AiSurfaceUsage {
  surface: AiSurface;
  calls: number;
  credits: number;
  creditsCharged: number;
}

export interface WalletSummary {
  balance: number;
  earned: number;
  spent: number;
  /** Rolling 30-day AI usage, per surface, highest metered cost first. */
  bySurface: AiSurfaceUsage[];
  freeUsedToday: Record<AiSurface, number>;
  enforced: boolean;
}

/** Wallet card data for the signed-in user. Returns null if either read fails. */
export async function fetchWalletSummary(userId: string): Promise<WalletSummary | null> {
  const supabase = await createClient();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [ledgerRes, usageRes, todayRes] = await Promise.all([
    supabase.from("credit_transactions").select("amount").eq("user_id", userId),
    supabase
      .from("ai_usage_events")
      .select("surface, credits, credits_charged")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("ai_usage_events")
      .select("surface")
      .eq("user_id", userId)
      .gte("created_at", kolkataDayStart()),
  ]);
  if (ledgerRes.error || usageRes.error || todayRes.error) return null;

  const amounts = (ledgerRes.data ?? []).map((r) => r.amount);
  const balance = amounts.reduce((sum, n) => sum + n, 0);
  const earned = amounts.filter((n) => n > 0).reduce((sum, n) => sum + n, 0);
  const spent = amounts.filter((n) => n < 0).reduce((sum, n) => sum - n, 0);

  const grouped = new Map<AiSurface, AiSurfaceUsage>();
  for (const row of usageRes.data ?? []) {
    const surface = row.surface as AiSurface;
    const entry = grouped.get(surface) ?? { surface, calls: 0, credits: 0, creditsCharged: 0 };
    entry.calls += 1;
    entry.credits += Number(row.credits ?? 0);
    entry.creditsCharged += row.credits_charged ?? 0;
    grouped.set(surface, entry);
  }

  const freeUsedToday = Object.fromEntries(AI_SURFACES.map((s) => [s, 0])) as Record<AiSurface, number>;
  for (const row of todayRes.data ?? []) {
    const surface = row.surface as AiSurface;
    if (surface in freeUsedToday) freeUsedToday[surface] += 1;
  }

  return {
    balance,
    earned,
    spent,
    bySurface: [...grouped.values()].sort((a, b) => b.credits - a.credits),
    freeUsedToday,
    enforced: creditsEnforced(),
  };
}

// Re-exported so route handlers can pull everything they need from one import.
export {
  AI_SURFACES,
  FREE_DAILY_CALLS,
  MIN_BALANCE_CREDITS,
  SURFACE_LABEL,
  insufficientCreditsMessage,
} from "./surfaces";
export type { AiSurface } from "./surfaces";
export type { PricedUsage };
