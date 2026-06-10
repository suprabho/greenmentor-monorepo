import {
  ChatCircleText,
  FileMagnifyingGlass,
  Strategy,
  ChartLineUp,
  FileDoc,
  ArrowRight,
  Coins,
  UploadSimple,
  Eye,
  Export,
} from "@phosphor-icons/react/dist/ssr";
import { Card, Chip, PageHeader } from "@/components/ui";
import { agentFamilies } from "@/lib/data";

const icons: Record<string, React.ElementType> = {
  ChatCircleText,
  FileMagnifyingGlass,
  Strategy,
  ChartLineUp,
  FileDoc,
};

export default function AgentsPage() {
  return (
    <div>
      <PageHeader
        title="Agentic"
        sub="Guided, reviewable AI workflows — not open-ended chat. Pick an agent, fill the brief, review the output, pay per run."
      />

      {/* How it works strip */}
      <Card className="mb-6 p-5">
        <div className="grid gap-4 text-center sm:grid-cols-4">
          {[
            { icon: UploadSimple, t: "1. Brief it", d: "Guided form — files, workspace, goal" },
            { icon: Coins, t: "2. See the price", d: "Credits shown before anything runs" },
            { icon: Eye, t: "3. Review", d: "Edit the output before accepting" },
            { icon: Export, t: "4. Keep it", d: "Saves to Longsite or exports DOCX/PDF/XLSX" },
          ].map((s) => (
            <div key={s.t} className="flex flex-col items-center gap-1.5">
              <span className="grid size-10 place-items-center rounded-xl bg-green-50 text-green-700">
                <s.icon size={20} />
              </span>
              <div className="text-[13px] font-semibold text-ink">{s.t}</div>
              <div className="text-[12px] text-gray-600">{s.d}</div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {agentFamilies.map((f) => {
          const Icon = icons[f.icon] ?? ChatCircleText;
          return (
            <Card key={f.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-2xl bg-teal-900 text-green-500">
                  <Icon size={22} />
                </span>
                <Chip tone="warn"><Coins size={11} weight="fill" /> {f.price}</Chip>
              </div>
              <h2 className="mt-3 text-[16px] font-semibold tracking-tight text-ink">{f.name}</h2>
              <p className="mt-1 flex-1 text-[13px] leading-relaxed text-gray-700">{f.desc}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {f.agents.map((a) => (
                  <span key={a} className="rounded-pill bg-gray-100 px-2.5 py-1 text-[11.5px] font-medium text-gray-700">
                    {a}
                  </span>
                ))}
              </div>
              <button className="mt-4 flex items-center justify-center gap-1.5 rounded-pill border border-teal-900 py-2 text-[12.5px] font-semibold text-teal-900 hover:bg-teal-900 hover:text-white">
                Run an agent <ArrowRight size={13} />
              </button>
            </Card>
          );
        })}

        {/* Example run card */}
        <Card className="border-green-500 p-5 ring-1 ring-green-500">
          <Chip tone="green">Example run</Chip>
          <h2 className="mt-3 text-[15px] font-semibold text-ink">Utility bill extractor</h2>
          <div className="mt-3 space-y-2 text-[12.5px]">
            <div className="rounded-lg bg-gray-50 p-2.5 text-gray-700">📎 12 PDFs uploaded · electricity + gas, Apr 25–Mar 26</div>
            <div className="rounded-lg bg-gray-50 p-2.5 text-gray-700">🎯 Target: Demo Workspace → Energy dataset</div>
            <div className="rounded-lg bg-green-50 p-2.5 font-semibold text-green-700">Price: 150 credits · est. 2 min</div>
          </div>
          <button className="mt-4 w-full rounded-pill bg-green-500 py-2 text-[12.5px] font-bold text-teal-900">
            Confirm & run · 150 cr
          </button>
        </Card>
      </div>
    </div>
  );
}
