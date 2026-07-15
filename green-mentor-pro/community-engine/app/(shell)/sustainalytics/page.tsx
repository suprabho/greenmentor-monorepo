import { ArrowSquareOut } from "@phosphor-icons/react/dist/ssr";
import { Card, PageHeader, Stat } from "@/components/ui";
import { SubindustryExplorer } from "@/components/sustainalytics/subindustry-explorer";
import { fetchSustainalytics, type SustainalyticsData } from "@/lib/sustainalytics/repo";
import { requireAdmin } from "@/lib/auth/admin";

export const metadata = { title: "Material ESG Issues — GreenMentor Community" };
export const dynamic = "force-dynamic";

const DEFINITIONS_PDF =
  "https://www.sustainalytics.com/docs/default-source/meis/definitionsofmeis.pdf?sfvrsn=8e7552c0_9";

export default async function SustainalyticsPage() {
  await requireAdmin();

  let data: SustainalyticsData | null = null;
  let loadError: string | null = null;
  try {
    data = await fetchSustainalytics();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "could not read the Sustainalytics tables";
  }

  const pairCount = data?.subindustries.reduce((n, s) => n + s.meis.length, 0) ?? 0;
  const avgPerSub =
    data && data.subindustries.length > 0 ? (pairCount / data.subindustries.length).toFixed(1) : "—";

  return (
    <div>
      <PageHeader
        title="Material ESG Issues"
        sub="Sustainalytics' materiality taxonomy — the ESG issues considered financially material for each subindustry, mapped to India's NIC-2008 sectors so it lines up with our BRSR data."
        action={
          <a
            href={DEFINITIONS_PDF}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded-pill border border-gray-200 bg-white px-3 py-1.5 text-[13px] font-semibold text-gray-700 hover:bg-gray-50"
          >
            Definitions PDF <ArrowSquareOut />
          </a>
        }
      />

      {loadError && (
        <Card className="mb-5 border-[#FFE0B2] bg-[#FFF8EE] p-4 text-[13px] text-[#8A5300]">
          Couldn’t load the taxonomy: {loadError}
        </Card>
      )}

      {data && (
        <>
          <Card className="mb-6 grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
            <Stat label="Material ESG Issues" value={String(data.catalog.length)} />
            <Stat label="Subindustries" value={String(data.subindustries.length)} />
            <Stat label="Applicable mappings" value={String(pairCount)} />
            <Stat label="Avg issues / subindustry" value={avgPerSub} />
          </Card>

          <section className="mb-8">
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              The {data.catalog.length} Material ESG Issues
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.catalog.map((m) => (
                <Card key={m.code} className="p-4">
                  <h3 className="text-[14px] font-semibold text-ink">{m.name}</h3>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-gray-600">{m.description}</p>
                </Card>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.08em] text-gray-500">
              By subindustry
            </h2>
            <SubindustryExplorer subindustries={data.subindustries} />
            {!data.hasCrosswalk && (
              <p className="mt-3 text-[12px] text-gray-400">
                NIC sector tags appear once the crosswalk (migration 0020 + <code>sustainalytics:crosswalk</code>) is applied.
              </p>
            )}
          </section>

          <p className="mt-8 max-w-3xl text-[12px] leading-relaxed text-gray-500">
            Source: Sustainalytics Material ESG Issues (MEIs). This is proprietary Sustainalytics reference data shown to
            admins for internal use only — not for public display or redistribution.
          </p>
        </>
      )}
    </div>
  );
}
