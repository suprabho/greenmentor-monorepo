"use client";

const SUGGESTIONS = [
  "Explain BRSR Principle 6 in plain terms",
  "Draft a data request for monthly grid electricity",
  "What goes into a materiality assessment?",
  "Summarize Scope 1, 2 and 3 for a manufacturer",
];

/** Claude-style quick-start chips under the welcome composer. */
export function SuggestionChips({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => onPick(s)}
          className="rounded-pill border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium text-gray-700 transition-colors hover:border-teal-700 hover:text-teal-800"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
