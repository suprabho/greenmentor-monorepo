import { notFound } from "next/navigation";
import { readPackage, listAgents } from "@/lib/agents/packageIO";
import PackageEditor from "../PackageEditor";

export const dynamic = "force-dynamic"; // reads the filesystem per request

export default async function AgentPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const meta = listAgents().find((a) => a.key === key);
  if (!meta) notFound();
  let pkg;
  try {
    pkg = readPackage(key);
  } catch {
    notFound();
  }
  return <PackageEditor key={meta.key} meta={meta} pkg={pkg} />;
}
