import { ArrowSquareOut, CheckCircle, Stack, Target } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import { bundleMeta } from "@/lib/academy/catalog";
import type { CatalogBundle } from "@/lib/academy/types";

/** Standalone INR price, e.g. "₹69,999" — same formatting as the pricing page. */
function formatINR(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

/**
 * A bundle — a priced collection of courses, sold on Learnyst. Sits in a 3-up
 * grid alongside its siblings, so the shape is a course card's (banner, body,
 * pinned CTA) rather than the full-width subscription block this replaced.
 *
 * The member course list is the selling point on a five-figure SKU, so it is
 * rendered whenever membership exists. It degrades to the advertised counts when
 * the sheet hasn't listed members yet — see CatalogBundle.courses.
 */
export function BundleCard({ bundle }: { bundle: CatalogBundle }) {
  const meta = bundleMeta(bundle);
  const hidden = bundle.courseCount != null ? bundle.courseCount - bundle.courses.length : 0;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex h-28 items-center justify-between bg-gradient-to-br from-teal-900 via-teal-800 to-green-800 px-5">
        <span className="grid size-11 place-items-center rounded-[10px] bg-white/10 text-green-500">
          <Stack size={24} weight="fill" />
        </span>
        <Chip tone="green">Bundle</Chip>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <Chip tone="teal">{bundle.level}</Chip>
          {bundle.priceInr != null && bundle.priceInr > 0 && (
            <span className="text-[13px] font-semibold text-ink">{formatINR(bundle.priceInr)}</span>
          )}
        </div>

        <h3 className="mt-3 text-[15.5px] font-semibold text-ink">{bundle.title}</h3>
        {meta && <p className="mt-1 text-[11.5px] font-semibold text-gray-500">{meta}</p>}
        {bundle.description && <p className="mt-2 text-[12.5px] text-gray-600">{bundle.description}</p>}

        {bundle.outcome && (
          <div className="mt-3 flex items-start gap-2 rounded-[8px] bg-green-50 p-3">
            <Target size={15} weight="duotone" className="mt-0.5 shrink-0 text-green-700" aria-hidden />
            <p className="text-[12px] leading-relaxed text-green-700">{bundle.outcome}</p>
          </div>
        )}

        {bundle.courses.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {bundle.courses.map((c) => (
              <li key={c.slug} className="flex items-start gap-2">
                <CheckCircle size={15} weight="fill" className="mt-0.5 shrink-0 text-green-500" />
                <span className="text-[12.5px] text-gray-700">{c.title}</span>
              </li>
            ))}
            {/* Never let the list silently under-report what was bought. */}
            {hidden > 0 && (
              <li className="pl-[23px] text-[12px] text-gray-500">
                + {hidden} more {hidden === 1 ? "course" : "courses"}
              </li>
            )}
          </ul>
        )}

        <div className="mt-auto pt-4">
          <a
            href={bundle.courseUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800"
          >
            View bundle on Learnyst <ArrowSquareOut size={13} />
          </a>
          <p className="mt-2 text-[11px] text-gray-500">Hosted on Learnyst — opens in a new tab.</p>
        </div>
      </div>
    </Card>
  );
}
