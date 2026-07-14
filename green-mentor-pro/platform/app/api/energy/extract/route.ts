// POST — Smart Upload: extract fields from an uploaded fuel/electricity bill
// with the vision model, resolve them to masters, and validate. Returns the raw
// extraction + resolved master ids + validation flags for the form to prefill.
// Does NOT persist anything — the user reviews, then submits via the normal route.
import { NextResponse } from "next/server";
import { getEngagementContext } from "@/lib/engagement-session";
import { getMasters } from "@/lib/energy/repo";
import { extractBill, resolveToMasters, runBillValidation, type BillType } from "@/lib/energy/extract";
import { jsonError } from "@/lib/api-error";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "application/pdf"]);
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request) {
  try {
    const ctx = await getEngagementContext();
    if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const form = await req.formData();
    const file = form.get("file");
    const billType = form.get("billType") as BillType | null;
    if (!(file instanceof File)) return NextResponse.json({ error: "no file" }, { status: 400 });
    if (billType !== "fuel" && billType !== "electricity") {
      return NextResponse.json({ error: "billType must be 'fuel' or 'electricity'" }, { status: 400 });
    }
    if (!ALLOWED.has(file.type)) {
      return NextResponse.json({ error: `Unsupported file type: ${file.type || "unknown"} (image or PDF only)` }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `File too large (max ${MAX_BYTES / 1024 / 1024} MB)` }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const extracted = await extractBill(billType, bytes, file.type);
    const masters = await getMasters();
    const resolved = resolveToMasters(billType, extracted, masters);
    const validation = runBillValidation(billType, extracted);

    return NextResponse.json({ extracted, resolved, validation });
  } catch (e) {
    return jsonError(e);
  }
}
