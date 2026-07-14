// POST → approve/reject a fugitive entry (maker–checker). Body { decision, feedback? }.
import { handleReview } from "@/lib/energy/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return handleReview(req, "energy_fugitive_entries", id);
}
