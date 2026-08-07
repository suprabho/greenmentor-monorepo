import Link from "next/link";
import { ImageSquare, FolderOpen, ArrowRight } from "@phosphor-icons/react/dist/ssr";
import type { Icon } from "@phosphor-icons/react";
import { AdminTable } from "@/components/admin";
import { Card, Chip, PageHeader } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { ADMIN_SECTIONS, type AdminSection } from "@/lib/admin/sections";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";

export const metadata = { title: "Admin — GreenMentor Community" };

function ago(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

/**
 * Live one-liners for section cards, keyed by href. The Pipeline card reads the
 * shared feed tables so the dashboard reflects the latest ingestion run (the
 * worker in .github/workflows/feed-ingest.yml). Built server-side per request.
 */
async function sectionStats(): Promise<Record<string, string>> {
  try {
    const supabase = await createClient();
    const [{ count }, { data: latest }, cardsRes] = await Promise.all([
      supabase.from("articles").select("id", { count: "exact", head: true }),
      supabase.from("articles").select("created_at").order("created_at", { ascending: false }).limit(1),
      supabase.from("community_share_cards").select("id", { count: "exact", head: true }),
    ]);
    const n = count ?? 0;
    const stats: Record<string, string> = {
      "/pipeline": `${n} article${n === 1 ? "" : "s"} · last ingest ${ago(latest?.[0]?.created_at ?? null)}`,
    };
    // Table may not be migrated yet — skip the stat rather than lose the others.
    if (cardsRes.count != null) {
      stats["/share-cards"] = `${cardsRes.count} saved card${cardsRes.count === 1 ? "" : "s"}`;
    }
    // community_stories/community_webinars have RLS enabled with no policies
    // (admin-only, service-role reads), so the anon/authenticated client
    // above can't see them — ask the admin client instead.
    if (isServiceRoleConfigured()) {
      const admin = createAdminClient();
      const [
        { count: storyCount },
        { count: webinarCount },
        { count: instructorCount },
        { count: jobCount },
      ] = await Promise.all([
        admin.from("community_stories").select("id", { count: "exact", head: true }),
        admin
          .from("community_webinars")
          .select("id", { count: "exact", head: true })
          .eq("status", "published")
          .gte("scheduled_at", new Date().toISOString()),
        admin.from("community_instructors").select("id", { count: "exact", head: true }),
        admin
          .from("community_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "published"),
      ]);
      if (storyCount != null) {
        stats["/stories"] = `${storyCount} stor${storyCount === 1 ? "y" : "ies"}`;
      }
      if (webinarCount != null) {
        stats["/webinars"] = `${webinarCount} upcoming`;
      }
      if (instructorCount != null) {
        stats["/instructors"] = `${instructorCount} instructor${instructorCount === 1 ? "" : "s"}`;
      }
      if (jobCount != null) {
        stats["/jobs"] = `${jobCount} published`;
      }
    }
    return stats;
  } catch {
    // Feed tables unavailable (env/RLS) — fall back to no live stat rather than 500 the hub.
    return {};
  }
}

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
  const stats = await sectionStats();

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
        <AdminTable
          rows={ADMIN_SECTIONS}
          rowKey={(section) => section.href}
          caption="Admin sections"
          empty="No admin sections configured."
          columns={[
            {
              key: "section",
              label: "Section",
              render: (section) => (
                <div className="flex items-center gap-3">
                  <span className={section.status === "soon" ? "grid size-9 place-items-center rounded-lg bg-gray-100 text-gray-400" : "grid size-9 place-items-center rounded-lg bg-green-50 text-green-700"}>
                    <section.icon size={19} />
                  </span>
                  <span className="font-semibold text-ink">{section.name}</span>
                </div>
              ),
            },
            {
              key: "description",
              label: "Description",
              responsive: "secondary",
              render: (section) => <span className="text-gray-600">{section.desc}</span>,
            },
            {
              key: "status",
              label: "Status",
              render: (section) => section.status === "soon" ? <Chip tone="neutral">Coming soon</Chip> : stats[section.href] ?? "Available",
            },
            {
              key: "actions",
              label: "Actions",
              sticky: true,
              className: "w-24 text-right",
              render: (section) => section.status === "soon" ? <span className="text-[12px] text-gray-400">—</span> : <Link href={section.href} className="text-[12px] font-semibold text-green-700 hover:underline">Open <ArrowRight size={12} className="inline" /></Link>,
            },
          ]}
        />
      </section>

      <section>
        <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
          Makers
        </h2>
        <AdminTable
          rows={makers}
          rowKey={(maker) => maker.href}
          caption="Maker tools"
          empty="No maker tools configured."
          columns={[
            {
              key: "maker",
              label: "Tool",
              render: (maker) => (
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-lg bg-green-50 text-green-700"><maker.icon size={19} /></span>
                  <span className="font-semibold text-ink">{maker.name}</span>
                </div>
              ),
            },
            {
              key: "description",
              label: "Description",
              responsive: "secondary",
              render: (maker) => <span className="text-gray-600">{maker.desc}</span>,
            },
            {
              key: "actions",
              label: "Actions",
              sticky: true,
              className: "w-24 text-right",
              render: (maker) => <Link href={maker.href} className="text-[12px] font-semibold text-green-700 hover:underline">Open <ArrowRight size={12} className="inline" /></Link>,
            },
          ]}
        />
      </section>
    </div>
  );
}

function SectionCard({ section, stat }: { section: AdminSection; stat?: string }) {
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
      {!soon && stat && (
        <span className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
          <span className="size-1.5 rounded-full bg-green-500" />
          {stat}
        </span>
      )}
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
