import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { deleteStorySource } from "@/lib/db/story-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; sourceId: string }> }
) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  const { id, sourceId } = await params;

  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  await deleteStorySource(createAdminClient(), id, sourceId);
  return NextResponse.json({ ok: true });
}
