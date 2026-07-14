import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { assess } from "@/lib/esg-readiness";
import { answersSchema } from "@/lib/esg-readiness/schema";
import { SECTORS, SUBSECTORS } from "@/lib/esg-readiness/questions";
import { toGatedResult } from "@/lib/esg-readiness/gated";

export const runtime = "nodejs";

/**
 * Public, anonymous assessment endpoint. Validates the 18 answers, runs the
 * engine, logs an anonymous row (no PII — lead details come later via
 * /api/esg-readiness/lead), and returns only the GATED result the results
 * screen may show (Doc 3): framework labels + icons, score, band. Confidence %,
 * reasoning, sub-area breakdown, best-practices and peer-benefits stay server-
 * side, gated to the PDF.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const body = json as { answers?: unknown; sourceUtm?: unknown };
  const parsed = answersSchema.safeParse(body.answers);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid answers", issues: parsed.error.flatten() },
      { status: 422 },
    );
  }
  const answers = parsed.data;
  const result = assess(answers);

  const sectorLabel = SECTORS.find((s) => s.code === answers.q1_sector)?.label ?? answers.q1_sector;
  // Q2 is free text when Q1 = "other"; otherwise it is one of the labels.
  const subsectorLabel = answers.q2_subsector;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("esg_assessments")
    .insert({
      source_utm: typeof body.sourceUtm === "string" ? body.sourceUtm : null,
      company_name: answers.companyName,
      answers,
      frameworks: result.frameworks,
      total_score: result.readiness.totalScore,
      band: result.readiness.band,
      band_color: result.readiness.bandColor,
      weakest_subarea: result.readiness.weakestSubarea,
      strongest_subarea: result.readiness.strongestSubarea,
      edge_case_flag: result.edgeCaseFlag,
      status: "assessment_only",
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });
  }

  return NextResponse.json({
    assessmentId: data.id,
    ...toGatedResult(result, {
      companyName: answers.companyName,
      sectorLabel,
      subsectorLabel,
    }),
  });
}
