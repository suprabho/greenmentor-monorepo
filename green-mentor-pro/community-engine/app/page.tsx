import Link from "next/link";
import { ImageSquare, FolderOpen, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { Card, Chip, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin/sections";

export const metadata = { title: "Admin — GreenMentor Community" };

/** Existing maker tools — folded in so nothing is lost when admin takes over `/`. */
const makers: { href: string; icon: Icon; name: string; desc: string }[] = [
  {
    href: "/header-studio",
    icon: ImageSquare,
    name: "Aura Header Studio",
    desc: "Compose webinar & newsletter headers over live aura backgrounds and export pixel-perfect PNGs.",
  },
  {
    href: "/library",
    icon: FolderOpen,
    name: "Saved headers",
    desc: "Open your personal library or headers the team has shared.",
  },
];

export default async function AdminHome() {
  const user = await requireAdmin();

  return (
    <div className="space-y-10">
      <PageHeader
        title="Community Admin"
        sub="Central hub for managing community content across GreenMentor."
        action={
          <span className="hidden text-[12.5px] text-gray-500 sm:block">
            Signed in as <span className="font-semibold text-gray-700">{user.email}</span>
          </span>
        }
      />

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          Sections
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_SECTIONS.map((s) => (
            <SectionCard key={s.href} section={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          Makers
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {makers.map((t) => (
            <Link key={t.href} href={t.href}>
              <Card className="group h-full p-5 transition-shadow hover:shadow-lift">
                <span className="grid size-11 place-items-center rounded-xl bg-green-50 text-green-700">
                  <t.icon size={22} />
                </span>
                <h3 className="mt-4 text-[15px] font-semibold text-ink">{t.name}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{t.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-green-700">
                  Open <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function SectionCard({ section }: { section: AdminSection }) {
  const soon = section.status === "soon";

  const inner = (
    <Card
      className={
        soon
          ? "h-full p-5 opacity-70"
          : "group h-full p-5 transition-shadow hover:shadow-lift"
      }
    >
      <div className="flex items-start justify-between">
        <span
          className={
            soon
              ? "grid size-11 place-items-center rounded-xl bg-gray-100 text-gray-400"
              : "grid size-11 place-items-center rounded-xl bg-green-50 text-green-700"
          }
        >
          <section.icon size={22} />
        </span>
        {soon && <Chip tone="neutral">Coming soon</Chip>}
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-ink">{section.name}</h3>
      <p className="mt-1 text-[13px] leading-relaxed text-gray-600">{section.desc}</p>
      {!soon && (
        <span className="mt-4 inline-flex items-center gap-1 text-[12.5px] font-semibold text-green-700">
          Open <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
        </span>
      )}
    </Card>
  );

  if (soon) return inner;
  return <Link href={section.href}>{inner}</Link>;
}
