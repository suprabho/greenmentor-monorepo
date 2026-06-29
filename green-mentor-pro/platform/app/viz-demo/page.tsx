import { GenericChart } from "@vismay/viz-engine";
import { Card, Chip, PageHeader } from "@/components/ui";

// Render proof for Increment 1, Step 1: a real @vismay/viz-engine chart module
// (echarts host + theme tokens + data fetch) rendering inside the platform app,
// transpiled directly from the vismay submodule. Data comes from the static
// route at /api/chart-data/demo/scope-emissions.
export default function VizDemo() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="viz-engine render proof"
        sub="A live @vismay/viz-engine chart module, transpiled from the submodule"
      />
      <Card className="space-y-3 p-5">
        <Chip tone="teal">@vismay/viz-engine · GenericChart</Chip>
        <div className="h-[380px] w-full">
          <GenericChart slug="demo" id="scope-emissions" activeStep={0} />
        </div>
      </Card>
    </div>
  );
}
