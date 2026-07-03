"use client";

/**
 * Inline error banner for the chat surfaces. The AI Hub chat previously swallowed
 * useChat's `error` entirely, so any failure (bad/missing model credential, an
 * HTTP 500, a dropped stream) looked like "no response at all". This surfaces the
 * cause and offers a Retry. Styling matches the buddy page's banner + the shared
 * `danger` token.
 */
export function ChatError({ error, onRetry }: { error?: Error; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="mx-auto mt-3 flex max-w-2xl items-start gap-3 rounded-[6px] border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">
      <span className="flex-1 font-medium leading-relaxed">{error.message || "Something went wrong."}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-danger/30 px-2 py-1 text-[12px] font-semibold hover:bg-danger/15"
        >
          Retry
        </button>
      )}
    </div>
  );
}
