import { Card, PageHeader, Chip, Stat } from "@/components/ui";
import { requireAdmin } from "@/lib/auth/admin";
import { IndustryExplorer } from "@/components/sasb/industry-explorer";
import { fetchSasb, type SasbData, type IssueCategory } from "@/lib/sasb/repo";
import { DIMENSION_ORDER, dimensionMeta } from "@/lib/sasb/dimensions";

export const metadata = { title: "SASB Materiality Finder — GreenMentor Community" };
export const dynamic = "force-dynamic";

export default async function SasbPage() {
  await requireAdmin();

  let data: SasbData | null = null;
  let loadError: string | null = null;
  try {
    data = await fetchSasb();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "could not read the SASB tables";
  }

  // The 26 issue categories grouped by dimension — doubles as the colour legend.
  const byDimension: [string, IssueCategory[]][] = data
    ? DIMENSION_ORDER.map((d) => [d, data!.issueCategories.filter((c) => c.dimension === d)] as [string, IssueCategory[]]).filter(
        ([, cs]) => cs.length > 0,
      )
    : [];

  return (
    <div>
      <PageHeader
        title="SASB Materiality Finder"
        sub="The SASB Standards' view of which sustainability issues are financially material to each of the 77 SICS industries, and the disclosure topics under each — crosswalked to India's NIC-2008 sectors so it lines up with our BRSR data."
        action={<Chip tone="teal">IFRS · SASB Standards</Chip>}
      />

      {loadError && (
        <Card className="mb-5 border-[#FFE0B2] bg-[#FFF8EE] p-4 text-[13px] text-[#8A5300]">
          Couldn’t load the taxonomy: {loadError}
        </Card>
      )}

      {data && (
        <>
          <Card className="mb-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <Stat label="SICS industries" value={String(data.industries.length)} />
            <Stat label="Issue categories" value={String(data.issueCategories.length)} />
            <Stat label="Material pairs" value={String(data.pairCount)} />
            <Stat label="Disclosure topics" value={String(data.topicCount)} />
          </Card>

          <section className="mb-8">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">
              The 5 dimensions · {data.issueCategories.length} General Issue Categories
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {byDimension.map(([dim, cats]) => {
                const meta = dimensionMeta(dim);
                return (
                  <Card key={dim} className="p-4">
                    <div className="mb-2.5 flex items-center gap-1.5">
                      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: meta.hue }} />
                      <h3 className="text-[13px] font-semibold text-ink">{dim}</h3>
                      <span className="ml-auto text-[11px] tabular-nums text-gray-400">{cats.length}</span>
                    </div>
                    <ul className="space-y-1">
                      {cats.map((c) => (
                        <li key={c.code} className="text-[12.5px] leading-snug text-gray-600">
                          {c.name}
                        </li>
                      ))}
                    </ul>
                  </Card>
                );
              })}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-gray-500">By industry</h2>
            <p className="mb-4 max-w-2xl text-[13px] text-gray-600">
              Pick an industry to see the issue categories SASB considers financially material to it, grouped by
              dimension, with the industry-specific disclosure topics under each.
            </p>
            <IndustryExplorer industries={data.industries} />
            {!data.hasCrosswalk && (
              <p className="mt-3 text-[12px] text-gray-400">
                NIC sector tags appear once the crosswalk (migration 0022 + <code>sasb:crosswalk</code>) is applied.
              </p>
            )}
          </section>

          <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-gray-500">
            Source: SASB Standards, maintained by the IFRS Foundation — the SICS® industries and their material General
            Issue Categories &amp; disclosure topics, retrieved from the public SASB Standards Navigator. Shown to admins
            as internal reference data.
          </p>
        </>
      )}
    </div>
  );
}
