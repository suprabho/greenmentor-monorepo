/**
 * GET → the text models this deployment can actually serve.
 *
 * A route rather than a constant in the client bundle because the answer depends on
 * SERVER env: on the direct-Anthropic path only Claude aliases resolve to a real
 * model, so offering the rest would let an author pick "GPT-5.6" and silently get
 * Sonnet. See `availableTextModels`.
 */

import { NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/auth/apiGate";
// The light module, not pipeline-store: this route needs the alias table, not the
// pack or the pipeline barrel.
import { availableTextModels, gmDefaultTextModel } from "@/lib/stories/text-models";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requireAdminApiUser();
  if ("error" in gate) return gate.error;
  return NextResponse.json({ models: availableTextModels(), default: gmDefaultTextModel() });
}
