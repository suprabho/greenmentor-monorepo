import { PlayCircle, FileText, Table, Database, Coins, LockSimpleOpen, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { libraryItems } from "@/lib/data";

const icons: Record<string, React.ElementType> = {
  Recording: PlayCircle,
  Guide: FileText,
  Template: Table,
  Dataset: Database,
};

export default function LibraryPage() {
  return (
    <div>
      <PageHeader
        title="Content library"
        sub="Webinar recordings, guides, templates and datasets. Free items open directly; premium items cost credits."
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex min-w-60 flex-1 items-center gap-2 rounded-pill border border-gray-200 bg-white px-4 py-2 text-[13px] text-gray-500 sm:max-w-sm">
          <MagnifyingGlass size={15} /> Search the library…
        </div>
        {["All", "Recordings", "Guides", "Templates", "Datasets"].map((f, i) => (
          <button
            key={f}
            className={
              i === 0
                ? "rounded-pill bg-teal-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white"
                : "rounded-pill border border-gray-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-gray-700"
            }
          >
            {f}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {libraryItems.map((item) => {
          const Icon = icons[item.type] ?? FileText;
          return (
            <Card key={item.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700">
                  <Icon size={22} />
                </span>
                {item.price === 0 ? (
                  <Chip tone="green"><LockSimpleOpen size={11} /> Free</Chip>
                ) : (
                  <Chip tone="warn"><Coins size={11} weight="fill" /> {item.price} cr</Chip>
                )}
              </div>
              <h3 className="mt-3 text-[14.5px] font-semibold leading-snug text-ink">{item.title}</h3>
              <p className="mt-1 text-[12px] text-gray-600">{item.type} · {item.meta}</p>
              <button
                className={
                  "mt-4 w-full rounded-pill py-2 text-[12.5px] font-semibold " +
                  (item.price === 0
                    ? "bg-teal-900 text-white hover:bg-teal-800"
                    : "border border-teal-900 text-teal-900 hover:bg-teal-900 hover:text-white")
                }
              >
                {item.price === 0 ? "Open" : `Unlock for ${item.price} credits`}
              </button>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
