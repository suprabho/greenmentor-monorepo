// ─────────────────────────────────────────────────────────────────────────────
// REAL CLAUDE API — extraction runs here in the browser
// Uses the Anthropic /v1/messages endpoint directly
// Model: claude-sonnet-4-6 (always pin version)
// ─────────────────────────────────────────────────────────────────────────────
export const CLAUDE_MODEL = "claude-sonnet-4-6";
export const PROMPT_VERSION = "v1.0";

const SYSTEM_PROMPT = `You are a utility bill data extraction specialist for an Indian government emissions auditing platform (Maharashtra, India).

Extract structured data from electricity and fuel bills with high accuracy.

STRICT RULES:
- Extract ONLY what is explicitly visible in the bill. Never infer or calculate missing values.
- For any field you cannot find or read clearly, set the value to null and its confidence to 0.0.
- Dates must be in ISO format: YYYY-MM-DD.
- Numbers must be numeric — no commas, no currency symbols, no units in the value field.
- bill_type must be exactly one of: electricity, fuel, water, other.
- discom must be one of: MSEDCL, BEST, Tata Power, Adani Electricity, MSEDC, MAHADISCOM, other.
- fuel_type must be one of: diesel, petrol, cng, lpg, hsd, furnace_oil, coal, biomass, natural_gas, kerosene, other.
- quantity_unit must be one of: litres, kg, SCM, MT, kL.
- confidence values must be floats between 0.0 and 1.0.
- Respond ONLY with a valid JSON object. No preamble, no explanation, no markdown fences.`;

const USER_PROMPT = `Extract all available fields from this utility bill. Return a JSON object with EXACTLY this structure:

{
  "bill_type": "electricity" | "fuel" | "water" | "other",
  "electricity": {
    "discom": string | null,
    "account_number": string | null,
    "consumer_name": string | null,
    "consumer_address": string | null,
    "consumer_category": string | null,
    "period_from": "YYYY-MM-DD" | null,
    "period_to": "YYYY-MM-DD" | null,
    "units_kwh": number | null,
    "peak_units_kwh": number | null,
    "offpeak_units_kwh": number | null,
    "solar_export_kwh": number | null,
    "sanctioned_load_kw": number | null,
    "amount_inr": number | null,
    "due_date": "YYYY-MM-DD" | null
  },
  "fuel": {
    "vendor_name": string | null,
    "vendor_gstin": string | null,
    "invoice_number": string | null,
    "invoice_date": "YYYY-MM-DD" | null,
    "fuel_type": "diesel"|"petrol"|"cng"|"lpg"|"hsd"|"furnace_oil"|"coal"|"biomass"|"natural_gas"|"kerosene"|"other" | null,
    "quantity": number | null,
    "quantity_unit": "litres"|"kg"|"SCM"|"MT"|"kL" | null,
    "vehicle_number": string | null,
    "asset_id": string | null,
    "amount_inr": number | null
  },
  "confidence": {
    "bill_type": 0.0,
    "account_number": 0.0,
    "consumer_name": 0.0,
    "period_from": 0.0,
    "period_to": 0.0,
    "units_kwh": 0.0,
    "amount_inr": 0.0,
    "vendor_gstin": 0.0,
    "invoice_number": 0.0,
    "fuel_type": 0.0,
    "quantity": 0.0
  },
  "extraction_notes": string | null
}

- Set electricity to null if this is not an electricity bill.
- Set fuel to null if this is not a fuel bill.
- In extraction_notes, note: Marathi/Hindi labels, poor quality, partial bill, net metering, estimated reading, multiple meters.`;

// SHA-256 hash of file — computed in browser via SubtleCrypto
export async function hashFile(arrayBuffer) {
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2,"0")).join("");
}

// Convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

// Map file MIME type to Claude accepted media_type
function getMediaType(mime) {
  const map = { "application/pdf":"application/pdf", "image/jpeg":"image/jpeg", "image/jpg":"image/jpeg", "image/png":"image/png", "image/gif":"image/gif", "image/webp":"image/webp" };
  return map[mime] || "image/jpeg";
}

// Compute overall confidence = min of all non-null values (strictest signal)
export function overallConf(scores) {
  const vals = Object.values(scores||{}).filter(v => v!=null && typeof v==="number" && v>0);
  return vals.length ? Math.min(...vals) : 0;
}

// REAL Claude API call — vision for images/PDFs, text for already-extracted strings.
// Auth: x-api-key is injected by the vite proxy from ANTHROPIC_API_KEY in .env.
export async function callClaudeExtract(file) {
  const arrayBuffer = await file.arrayBuffer();
  const base64 = arrayBufferToBase64(arrayBuffer);
  const mediaType = getMediaType(file.type);

  // Build message content based on file type
  // PDFs: use document block (Claude handles multi-page PDFs natively)
  // Images: use image block
  const contentBlock = file.type === "application/pdf"
    ? { type:"document", source:{ type:"base64", media_type:"application/pdf", data:base64 } }
    : { type:"image",    source:{ type:"base64", media_type:mediaType,         data:base64 } };

  const response = await fetch("/anthropic/v1/messages", {
    method: "POST",
    // API key injected by Vite proxy — not sent from browser
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 1000,
      system: SYSTEM_PROMPT,
      messages: [{ role:"user", content:[ contentBlock, { type:"text", text:USER_PROMPT } ] }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(()=>({}));
    throw new Error(`Claude API error ${response.status}: ${err?.error?.message || response.statusText}`);
  }

  const data = await response.json();
  const rawText = data.content?.find(b=>b.type==="text")?.text || "";
  const usage = data.usage;

  // Parse JSON — strip accidental markdown fences
  const cleaned = rawText.replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/\s*```$/i,"").trim();
  let parsed;
  try { parsed = JSON.parse(cleaned); }
  catch(e) { throw new Error(`JSON parse failed: ${e.message}. Raw: ${rawText.slice(0,300)}`); }

  return { parsed, rawText, usage };
}
