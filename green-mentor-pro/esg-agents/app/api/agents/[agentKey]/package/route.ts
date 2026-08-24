import { NextResponse } from "next/server";
import {
  readPackageWithOverrides,
  revertPackageFile,
  savePackageFile,
} from "@/lib/agents/packageIO";
import { getSession } from "@/lib/auth/session";

export const runtime = "nodejs"; // reads the bundled package files off disk

/**
 * Agent Studio package IO. Reads serve the bundled files with any stored edits laid
 * on top; writes go to the store (supabase/migrations/0003), because the deployed
 * filesystem is read-only.
 *
 * These edits are global — every engagement and both apps run what is saved here —
 * so unlike before, the handlers require a session. The middleware only checks that
 * a session cookie is present.
 */

async function requireUser() {
  const session = await getSession();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { userUuid: session.userUuid };
}

/** GET the effective package files for an agent, plus which are stored edits. */
export async function GET(_req: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await readPackageWithOverrides(agentKey));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "read failed" }, { status: 404 });
  }
}

/** PUT one edited file to the store. Body: { file, content }. */
export async function PUT(req: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await savePackageFile(agentKey, body.file, body.content ?? "", auth.userUuid));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "save failed" }, { status: 400 });
  }
}

/** DELETE a stored edit so the file reverts to the deployed package. Body: { file }. */
export async function DELETE(req: Request, { params }: { params: Promise<{ agentKey: string }> }) {
  const { agentKey } = await params;
  const auth = await requireUser();
  if ("error" in auth) return auth.error;
  const body = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await revertPackageFile(agentKey, body.file));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "revert failed" }, { status: 400 });
  }
}
