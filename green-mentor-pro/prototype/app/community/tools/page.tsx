import Link from "next/link";
import { ImageSquare, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";

const tools = [
  {
    href: "/community/tools/header-studio",
    icon: ImageSquare,
    name: "Aura Header Studio",
    desc: "Compose webinar & newsletter headers over live aura backgrounds and export pixel-perfect PNGs.",
    tag: "New",
  },
];

export default function ToolsPage() {
  return (
    <div>
      <PageHeader
        title="Community Tools"
        sub="Lightweight makers for the community team — built on the GreenMentor design system."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="group h-full p-5 transition-shadow hover:shadow-lift">
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-green-50 text-green-700">
                  <t.icon size={22} />
                </span>
                {t.tag && <Chip tone="green">{t.tag}</Chip>}
              </div>
              <h3 className="mt-4 text-[15px] font-semibold text-ink">{t.name}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{t.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-green-700">
                Open <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
