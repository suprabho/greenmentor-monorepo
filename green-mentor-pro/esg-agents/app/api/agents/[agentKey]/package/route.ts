import { NextResponse } from "next/server";
import { readPackage, writePackageFile } from "@/lib/agents/packageIO";

export const runtime = "nodejs"; // filesystem access

/** GET the raw package files for an agent. */
export async function GET(_req: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  try {
    return NextResponse.json(readPackage(agentKey));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "read failed" }, { status: 404 });
  }
}

/** PUT one edited file back to disk. Body: { file, content }. */
export async function PUT(req: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const body = await req.json().catch(() => ({}));
  try {
    const result = writePackageFile(agentKey, body.file, body.content ?? "");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "save failed" }, { status: 400 });
  }
}
