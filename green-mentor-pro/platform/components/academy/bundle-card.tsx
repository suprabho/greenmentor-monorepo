import { ArrowSquareOut, CheckCircle, Stack } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip } from "@/components/ui";
import type { BundleCatalogEntry } from "@/lib/academy/catalog-extras";

/**
 * Full-width bundle card — deliberately a different shape from the course
 * grids so it reads as a subscription, not another course. External CTA only;
 * the card itself is not clickable.
 */
export function BundleCard({ bundle }: { bundle: BundleCatalogEntry }) {
  return (
    <Card className="grid gap-6 p-6 lg:grid-cols-[280px_1fr] lg:p-8">
      <div>
        <span className="grid size-11 place-items-center rounded-[10px] bg-teal-900 text-green-500">
          <Stack size={24} weight="fill" />
        </span>
        <div className="mt-3 flex items-center gap-2">
          <h3 className="text-[17px] font-semibold text-ink">{bundle.name}</h3>
          <Chip tone="teal">Bundle</Chip>
        </div>
        <p className="mt-1.5 text-[12.5px] text-gray-600">{bundle.description}</p>
        <a
          href={bundle.learnystUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 rounded-pill bg-teal-900 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-teal-800"
        >
          View plan on Learnyst <ArrowSquareOut size={13} />
        </a>
        <p className="mt-2 text-[11px] text-gray-500">Hosted on Learnyst — opens in a new tab.</p>
      </div>
      <ul className="grid content-start gap-x-6 gap-y-2.5 sm:grid-cols-2">
        {bundle.courses.map((c) => (
          <li key={c.id} className="flex items-start gap-2">
            <CheckCircle size={16} weight="fill" className="mt-0.5 shrink-0 text-green-500" />
            <span className="min-w-0">
              <span className="block text-[13px] font-semibold text-ink">{c.title}</span>
              <span className="block text-[11.5px] text-gray-500">
                {c.framework} · {c.lessons} {c.lessons === 1 ? "lesson" : "lessons"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
