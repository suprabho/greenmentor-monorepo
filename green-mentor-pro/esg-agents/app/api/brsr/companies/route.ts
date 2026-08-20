import { NextResponse } from "next/server";
import { listBrsrCompanies } from "@gm/orchestrator/peer";

export const runtime = "nodejs"; // service-role Supabase read

/**
 * Company picker for the Agent Studio's peer-research test bench — the BRSR
 * corpus directory (cleanly profiled filings, latest FY per symbol), the same
 * data behind the BRSR intelligence reports.
 *
 * Behind the session middleware like every other Studio route. Reads public
 * regulatory data, so no tenant scoping.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("q") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? 50);

  try {
    const companies = await listBrsrCompanies({
      search,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    return NextResponse.json({ companies, count: companies.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "company lookup failed";
    // Most likely cause locally: SUPABASE_SERVICE_ROLE_KEY missing from .env.local.
    return NextResponse.json({ error: message, companies: [] }, { status: 500 });
  }
}
