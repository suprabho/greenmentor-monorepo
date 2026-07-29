import { Card, Chip, Stat } from "@/components/ui";
import { AI_SURFACES, FREE_DAILY_CALLS, SURFACE_LABEL } from "@/lib/ai/surfaces";
import type { WalletSummary } from "@/lib/ai/usage";

/**
 * Wallet card — the credits balance plus what AI usage is costing.
 *
 * Credits are one balance for the whole product (PRD §7): "coins" in the learner
 * UI and "credits" here are the same `credit_transactions` ledger, so this shows
 * Academy earnings and AI spend side by side rather than as separate currencies.
 *
 * Server component (reads run on the caller's own session, owner-read RLS).
 */
export function CreditsCard({ summary }: { summary: WalletSummary | null }) {
  if (!summary) {
    return (
      <Card className="space-y-2 p-6">
        <div className="text-[15px] font-semibold text-ink">Credits</div>
        <p className="text-[13px] text-gray-600">
          Couldn&apos;t load your balance — the credits migrations may not have run yet.
        </p>
      </Card>
    );
  }

  const meteredCredits = summary.bySurface.reduce((sum, s) => sum + s.credits, 0);
  const totalCalls = summary.bySurface.reduce((sum, s) => sum + s.calls, 0);

  return (
    <Card className="space-y-5 p-6">
      <div className="flex items-center gap-3">
        <div className="text-[15px] font-semibold text-ink">Credits</div>
        {summary.enforced ? (
          <Chip tone="green">Charging on</Chip>
        ) : (
          // Metering runs before prices bite — see AI_CREDITS_ENFORCED in lib/ai/usage.ts.
          <Chip tone="warn">Tracking only</Chip>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-4">
        <Stat label="Balance" value={`${fmt(summary.balance)} cr`} sub="1 credit = ₹1" />
        <Stat label="Earned" value={`${fmt(summary.earned)} cr`} sub="Academy & streaks" />
        <Stat label="Spent" value={`${fmt(summary.spent)} cr`} sub="All time" />
      </dl>

      <div className="space-y-3 border-t border-gray-100 pt-4">
        <div className="flex items-baseline justify-between">
          <div className="text-[13px] font-semibold text-ink">AI usage — last 30 days</div>
          <div className="text-[12px] text-gray-500">
            {totalCalls === 0 ? "No calls yet" : `${totalCalls} call${totalCalls === 1 ? "" : "s"}`}
          </div>
        </div>

        {totalCalls === 0 ? (
          <p className="text-[13px] text-gray-600">
            Ask ESG Buddy something or run a Smart Upload and your usage will show up here.
          </p>
        ) : (
          <ul className="space-y-2">
            {summary.bySurface.map((s) => (
              <li key={s.surface} className="flex items-baseline justify-between gap-3 text-[13px]">
                <span className="min-w-0 truncate text-gray-700">{SURFACE_LABEL[s.surface]}</span>
                <span className="shrink-0 tabular-nums text-gray-500">
                  {s.calls} · {fmt(s.credits, 1)} cr
                  {/* credits = metered cost; credits_charged = what actually left the
                      balance. They differ whenever a call was free-tier or unenforced. */}
                  {s.creditsCharged !== Math.round(s.credits) && (
                    <span className="text-gray-400"> ({s.creditsCharged} charged)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}

        {meteredCredits > 0 && !summary.enforced && (
          <p className="text-[12px] text-gray-500">
            {fmt(meteredCredits, 1)} cr of AI usage measured but not charged.
          </p>
        )}
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-4">
        <div className="text-[13px] font-semibold text-ink">Free allowance today</div>
        <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5">
          {AI_SURFACES.map((surface) => {
            const used = summary.freeUsedToday[surface];
            const allowance = FREE_DAILY_CALLS[surface];
            const left = Math.max(0, allowance - used);
            return (
              <li key={surface} className="flex items-baseline justify-between gap-2 text-[12.5px]">
                <span className="min-w-0 truncate text-gray-600">{SURFACE_LABEL[surface]}</span>
                <span className={left === 0 ? "shrink-0 tabular-nums text-gray-400" : "shrink-0 tabular-nums text-gray-700"}>
                  {left}/{allowance}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="text-[12px] text-gray-500">Resets daily at midnight IST. Past the allowance, calls are metered.</p>
      </div>
    </Card>
  );
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: decimals });
}
