import { notFound } from "next/navigation";
import { listAgentsWithOverrides, readPackageWithOverrides } from "@/lib/agents/packageIO";
import PackageEditor from "../PackageEditor";

export const dynamic = "force-dynamic"; // reads the package + its stored edits per request

export default async function AgentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const meta = (await listAgentsWithOverrides()).find((a) => a.key === key);
  if (!meta) notFound();
  let pkg;
  try {
    pkg = await readPackageWithOverrides(key);
  } catch {
    notFound();
  }
  return <PackageEditor key={meta.key} meta={meta} pkg={pkg} />;
}
