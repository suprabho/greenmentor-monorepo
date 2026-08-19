/**
 * One weekly recap: the full row (incl. markdown + topics) for the compose
 * flow's topic picker and the attach path, plus deletion.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
import { createAdminClient, isServiceRoleConfigured } from "@/lib/supabase/admin";
import { getRecap, deleteRecap } from "@/lib/db/recaps";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  const { id } = await params;
  const recap = await getRecap(createAdminClient(), id);
  if (!recap) return NextResponse.json({ error: "recap not found" }, { status: 404 });
  return NextResponse.json({ ok: true, recap });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  if (!isServiceRoleConfigured()) return NextResponse.json({ ok: true, mode: "unconfigured" });

  const { id } = await params;
  await deleteRecap(createAdminClient(), id);
  return NextResponse.json({ ok: true });
}
