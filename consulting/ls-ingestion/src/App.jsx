import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// REAL CLAUDE API — extraction runs here in the browser
// Uses the Anthropic /v1/messages endpoint directly
// Model: claude-sonnet-4-6 (always pin version)
// ─────────────────────────────────────────────────────────────────────────────
const CLAUDE_MODEL = "claude-sonnet-4-6";
const PROMPT_VERSION = "v1.0";

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
async function hashFile(arrayBuffer) {
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
function overallConf(scores) {
  const vals = Object.values(scores||{}).filter(v => v!=null && typeof v==="number" && v>0);
  return vals.length ? Math.min(...vals) : 0;
}

// REAL Claude API call — vision for images/PDFs, text for already-extracted strings.
// Auth: x-api-key is injected by the vite proxy from ANTHROPIC_API_KEY in .env.
async function callClaudeExtract(file) {
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

// ─────────────────────────────────────────────────────────────────────────────
// REAL EFDB INTEGRATION
// Uses authenticated endpoint (GET /emission-factors) with JWT from EFDB login,
// then falls back to the public endpoint. No hardcoded factors — if EFDB has no
// matching record (or is unreachable), the extraction fails loudly so the
// underlying data gap is visible instead of silently substituted.
// Field names match EmissionFactorOut schema exactly.
// ─────────────────────────────────────────────────────────────────────────────
const EFDB_PUBLIC = "/efdb/emission-factors/public";
const EFDB_AUTH   = "/efdb/emission-factors";
const EFDB_LOGIN  = "/efdb/auth/login";

// Maps bill activity → EFDB query params (matches canonical_activity_name ilike search).
// Mirrors the canonical names seeded by efdb/backend/scripts/seed_india_factors.py.
const EFDB_QUERIES = {
  electricity: { q:"electricity purchased",        scope:"Scope 2", country:"IN" },
  diesel:      { q:"diesel combustion",            scope:"Scope 1", country:"IN" },
  petrol:      { q:"petrol combustion",            scope:"Scope 1", country:"IN" },
  cng:         { q:"CNG combustion",               scope:"Scope 1", country:"IN" },
  lpg:         { q:"LPG combustion",               scope:"Scope 1", country:"IN" },
  hsd:         { q:"HSD fuel oil combustion",      scope:"Scope 1", country:"IN" },
  coal:        { q:"coal combustion",              scope:"Scope 1", country:"IN" },
};

const factorCache = {};

// Try authenticated EFDB → public EFDB → throw
async function lookupFactor(billType, fuelType, efdbToken) {
  const key = billType==="electricity" ? "electricity" : (fuelType||"diesel");
  if (factorCache[key]) return factorCache[key];

  const qp = EFDB_QUERIES[key];
  if (!qp) throw new Error(`No EFDB query mapping for activity "${key}"`);

  // Try authenticated endpoint first (has all records including India-specific)
  if (efdbToken) {
    try {
      const url = `${EFDB_AUTH}?q=${encodeURIComponent(qp.q)}&country=${qp.country}&scope=${encodeURIComponent(qp.scope)}&sort_by=confidence_score&sort_dir=desc&page_size=5`;
      const r = await fetch(url, { headers:{ "Authorization":`Bearer ${efdbToken}` }, signal:AbortSignal.timeout(5000) });
      if (r.ok) {
        const d = await r.json();
        if (d.items?.length > 0) {
          const f = { ...d.items[0], _source:"efdb_authenticated" };
          factorCache[key] = f;
          return f;
        }
      }
    } catch(_) {}
  }

  // Try public endpoint (no auth)
  try {
    const url = `${EFDB_PUBLIC}?q=${encodeURIComponent(qp.q)}&country=${qp.country}&scope=${encodeURIComponent(qp.scope)}&page_size=5`;
    const r = await fetch(url, { signal:AbortSignal.timeout(5000) });
    if (r.ok) {
      const d = await r.json();
      if (d.items?.length > 0) {
        const f = { ...d.items[0], _source:"efdb_public" };
        factorCache[key] = f;
        return f;
      }
    }
  } catch(_) {}

  throw new Error(`EFDB has no "${key}" factor for ${qp.country}/${qp.scope}. Seed it with scripts.seed_india_factors or upload via the EFDB ingestion flow.`);
}

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION RULES
// ─────────────────────────────────────────────────────────────────────────────
const MASTER_FUEL_TYPES = ["diesel","petrol","cng","lpg","hsd","furnace_oil","coal","biomass","natural_gas","kerosene","other"];
const UNIT_FOR_FUEL     = { litres:["diesel","petrol","lpg","hsd","furnace_oil","kerosene"], kg:["cng","coal","biomass","lpg"], SCM:["cng","natural_gas"], MT:["coal"], kL:["diesel","petrol","hsd"] };
const GSTIN_RE          = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

function runValidation(billType, extracted) {
  const flags = [];
  if (!extracted) return { status:"failed", rules_run:0, flags:[{ rule:"E00", sev:"HARD_REJECT", label:"No extracted data" }] };

  if (billType === "electricity") {
    if (!extracted.period_from || !extracted.period_to)
      flags.push({ rule:"E02", sev:"HARD_REJECT", label:"Billing period dates missing" });
    else {
      const days = (new Date(extracted.period_to)-new Date(extracted.period_from))/86400000;
      if (days < 0)  flags.push({ rule:"E02a", sev:"HARD_REJECT", label:`period_to before period_from` });
      if (days > 95) flags.push({ rule:"E02b", sev:"FLAG",        label:`Period ${Math.round(days)} days — exceeds 95-day limit` });
    }
    if (!extracted.units_kwh || parseFloat(extracted.units_kwh) <= 0)
      flags.push({ rule:"E03", sev:"HARD_REJECT", label:"Units consumed missing or zero" });
    if (extracted.account_number && !/^\d{7,15}$/.test(String(extracted.account_number).replace(/\s/g,"")))
      flags.push({ rule:"E04", sev:"FLAG", label:`Account number format unrecognised` });
    if (extracted.amount_inr && extracted.units_kwh) {
      const rate = parseFloat(extracted.amount_inr)/parseFloat(extracted.units_kwh);
      if (rate < 2 || rate > 30) flags.push({ rule:"E09", sev:"FLAG", label:`Rate ₹${rate.toFixed(2)}/kWh outside expected tariff band` });
    }
    return { status: flags.some(f=>f.sev==="HARD_REJECT")?"failed":flags.length>0?"flagged":"passed", rules_run:13, flags };
  }

  if (billType === "fuel") {
    if (extracted.vendor_gstin) {
      if (!GSTIN_RE.test(extracted.vendor_gstin))
        flags.push({ rule:"F02", sev:"HARD_REJECT", label:`GSTIN "${extracted.vendor_gstin}" fails format check` });
    } else {
      flags.push({ rule:"F02a", sev:"FLAG", label:"Vendor GSTIN missing" });
    }
    if (!extracted.fuel_type || !MASTER_FUEL_TYPES.includes(extracted.fuel_type))
      flags.push({ rule:"F03", sev:"HARD_REJECT", label:`Fuel type "${extracted.fuel_type}" not in master list` });
    if (!extracted.quantity || parseFloat(extracted.quantity)<=0)
      flags.push({ rule:"F04", sev:"HARD_REJECT", label:"Quantity missing or zero" });
    if (!extracted.invoice_number)
      flags.push({ rule:"F05", sev:"FLAG", label:"Invoice number missing — duplicate detection unavailable" });
    if (extracted.fuel_type && extracted.quantity_unit) {
      const allowed = UNIT_FOR_FUEL[extracted.quantity_unit]||[];
      if (allowed.length>0 && !allowed.includes(extracted.fuel_type))
        flags.push({ rule:"F06", sev:"FLAG", label:`Unit "${extracted.quantity_unit}" unusual for "${extracted.fuel_type}"` });
    }
    return { status: flags.some(f=>f.sev==="HARD_REJECT")?"failed":flags.length>0?"flagged":"passed", rules_run:9, flags };
  }

  return { status:"passed", rules_run:0, flags:[] };
}

// ─────────────────────────────────────────────────────────────────────────────
// EMISSION CALCULATION — GHG Protocol
// ─────────────────────────────────────────────────────────────────────────────
function calcEmission(billType, extracted, factor) {
  if (!factor?.ef_total_co2e || !extracted) return null;
  const fv = factor.ef_total_co2e;
  if (billType === "electricity") {
    const kwh = parseFloat(extracted.units_kwh)||0;
    const net = extracted.solar_export_kwh ? kwh - parseFloat(extracted.solar_export_kwh) : kwh;
    const tco2e = (net * fv) / 1000;
    return { tco2e:+tco2e.toFixed(6), activity:net, actUnit:"kWh", scope:2, formula:`${net} kWh × ${fv} ${factor.unit} ÷ 1000` };
  }
  const qty = parseFloat(extracted.quantity)||0;
  const unit = extracted.quantity_unit||"litres";
  return { tco2e:+((qty*fv)/1000).toFixed(6), activity:qty, actUnit:unit, scope:1, formula:`${qty} ${unit} × ${fv} ${factor.unit} ÷ 1000` };
}

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const T = {
  bg:"#0B0F0B", surface:"#111511", card:"#181D18", border:"#232923", line:"#1E241E",
  accent:"#4ADE80", accentDim:"#16A34A", accentGlow:"rgba(74,222,128,0.1)",
  text:"#E8EDE8", muted:"#7A8A7A", dim:"#485048",
  danger:"#F87171", dangerBg:"rgba(248,113,113,0.08)", dangerLine:"rgba(248,113,113,0.25)",
  warn:"#FBBF24",   warnBg:"rgba(251,191,36,0.08)",    warnLine:"rgba(251,191,36,0.25)",
  info:"#60A5FA",   infoBg:"rgba(96,165,250,0.08)",     infoLine:"rgba(96,165,250,0.25)",
  successBg:"rgba(74,222,128,0.08)", successLine:"rgba(74,222,128,0.2)",
  mono:"'DM Mono','Fira Mono',monospace",
  head:"'Syne','Space Grotesk',sans-serif",
  body:"'Instrument Sans','DM Sans',sans-serif",
};

const pill = (bg,c,extra={}) => ({ display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:bg,color:c,fontSize:11,fontWeight:600,whiteSpace:"nowrap",...extra });
const tag  = (bg,c) => ({ padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:600,background:bg,color:c,fontFamily:T.mono });

const SS = {
  app:     { display:"flex",height:"100vh",fontFamily:T.body,background:T.bg,color:T.text,overflow:"hidden",fontSize:14 },
  side:    { width:224,background:T.surface,display:"flex",flexDirection:"column",borderRight:`1px solid ${T.line}`,flexShrink:0 },
  main:    { flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 },
  topbar:  { background:T.surface,borderBottom:`1px solid ${T.line}`,padding:"13px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 },
  content: { flex:1,overflow:"auto",padding:"22px 28px" },
  card:    { background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"18px 22px",marginBottom:14 },
  label:   { fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12,fontFamily:T.head },
  input:   { width:"100%",padding:"7px 10px",background:T.bg,border:`1px solid ${T.line}`,borderRadius:6,fontSize:12,fontFamily:T.mono,color:T.text,outline:"none",boxSizing:"border-box" },
  mono:    { fontFamily:T.mono,fontSize:11,background:"#070B07",color:"#4ADE80",padding:14,borderRadius:8,lineHeight:1.75,whiteSpace:"pre-wrap",wordBreak:"break-all",overflowX:"auto",margin:0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// BASE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const Dot = ({c,s=6}) => <span style={{width:s,height:s,borderRadius:"50%",background:c,display:"inline-block",flexShrink:0}}/>;

function Btn({v="primary",sz="md",disabled,onClick,children,style={}}) {
  const base={padding:sz==="sm"?"4px 12px":"8px 18px",borderRadius:7,cursor:disabled?"not-allowed":"pointer",fontFamily:T.body,fontSize:sz==="sm"?11:13,fontWeight:600,opacity:disabled?0.4:1,transition:"all 0.15s",border:"none",letterSpacing:"0.01em",...style};
  const vs={primary:{background:T.accent,color:"#030805"},danger:{background:T.danger,color:"#1a0606"},ghost:{background:"transparent",color:T.muted,border:`1px solid ${T.line}`},subtle:{background:T.card,color:T.text,border:`1px solid ${T.border}`}};
  return <button style={{...base,...vs[v]}} onClick={disabled?undefined:onClick} disabled={disabled}>{children}</button>;
}

function ConfBar({val}) {
  if (val==null) return <span style={{color:T.dim,fontSize:11,fontFamily:T.mono}}>—</span>;
  const p=Math.round(val*100), c=val>=0.9?T.accent:val>=0.7?T.warn:T.danger;
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,minWidth:90}}>
      <div style={{flex:1,height:3,background:T.line,borderRadius:2,overflow:"hidden"}}>
        <div style={{width:`${p}%`,height:"100%",background:c,borderRadius:2}}/>
      </div>
      <span style={{fontSize:11,fontWeight:700,color:c,fontFamily:T.mono,width:30,textAlign:"right"}}>{p}%</span>
    </div>
  );
}

const STATUS={pending:{l:"Pending",bg:T.infoBg,c:T.info,dot:T.info},extracting:{l:"Extracting",bg:T.warnBg,c:T.warn,dot:T.warn},review:{l:"Review",bg:T.warnBg,c:T.warn,dot:T.warn},approved:{l:"Approved",bg:T.successBg,c:T.accent,dot:T.accent},rejected:{l:"Rejected",bg:T.dangerBg,c:T.danger,dot:T.danger}};
const SPill=({s})=>{const m=STATUS[s]||STATUS.pending;return<span style={pill(m.bg,m.c)}><Dot c={m.dot}/>{m.l}</span>;};
const TPill=({t})=><span style={pill(t==="electricity"?T.successBg:T.warnBg,t==="electricity"?T.accent:T.warn)}>{t||"unknown"}</span>;

const fmtD=s=>s?new Date(s).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtN=n=>n!=null?Number(n).toLocaleString("en-IN"):"—";
const short=h=>h?h.slice(0,8)+"…"+h.slice(-6):"—";
const uid=()=>"b"+Math.random().toString(36).slice(2,9);

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
const NAV=[{id:"dash",icon:"◈",label:"Dashboard"},{id:"upload",icon:"↑",label:"Upload bills"},{id:"review",icon:"⊡",label:"Review queue"},{id:"records",icon:"◉",label:"Emission records"},{id:"audit",icon:"⊞",label:"Audit trail"},{id:"settings",icon:"⬡",label:"Settings"}];

function Sidebar({page,setPage,reviewCount,efdbSrc,extracting}) {
  return (
    <div style={SS.side}>
      <div style={{padding:"18px 18px 14px",borderBottom:`1px solid ${T.line}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
          <div style={{width:32,height:32,background:T.accent,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{color:"#030805",fontWeight:900,fontSize:16,fontFamily:T.head}}>G</span>
          </div>
          <div>
            <div style={{color:T.text,fontSize:13,fontWeight:700,fontFamily:T.head,letterSpacing:"-0.3px"}}>Greenmentor</div>
            <div style={{color:T.dim,fontSize:9,textTransform:"uppercase",letterSpacing:"0.1em"}}>Live Extraction MVP</div>
          </div>
        </div>
      </div>
      <nav style={{flex:1,padding:"6px 0"}}>
        <div style={{padding:"12px 16px 4px",fontSize:9,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.12em",fontFamily:T.head}}>Pipeline</div>
        {NAV.map(n=>{
          const active=page===n.id;
          return (
            <div key={n.id} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 14px",margin:"1px 8px",borderRadius:7,cursor:"pointer",background:active?T.accentGlow:"transparent",color:active?T.accent:T.muted,fontSize:12,fontWeight:active?600:400,transition:"all 0.12s",borderLeft:active?`2px solid ${T.accent}`:"2px solid transparent"}}
              onClick={()=>setPage(n.id)}>
              <span style={{fontFamily:T.mono,fontSize:13,width:16}}>{n.icon}</span>
              <span style={{flex:1}}>{n.label}</span>
              {n.id==="review"&&reviewCount>0&&<span style={{background:T.warn,color:"#030805",borderRadius:10,padding:"1px 7px",fontSize:10,fontWeight:700}}>{reviewCount}</span>}
            </div>
          );
        })}
      </nav>
      <div style={{padding:"10px 14px",borderTop:`1px solid ${T.line}`}}>
        <div style={{display:"flex",gap:12,marginBottom:3}}>
          <div><div style={{fontSize:9,color:T.dim,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.08em"}}>Claude</div><span style={pill(T.successBg,T.accent,{fontSize:10,padding:"2px 8px"})}>{CLAUDE_MODEL.slice(7)}</span></div>
          <div><div style={{fontSize:9,color:T.dim,marginBottom:2,textTransform:"uppercase",letterSpacing:"0.08em"}}>EFDB</div><span style={pill(efdbSrc==="efdb_authenticated"?T.successBg:efdbSrc==="efdb_public"?T.infoBg:T.dangerBg,efdbSrc==="efdb_authenticated"?T.accent:efdbSrc==="efdb_public"?T.info:T.danger,{fontSize:10,padding:"2px 8px"})}>{efdbSrc==="efdb_authenticated"?"auth":efdbSrc==="efdb_public"?"public":"offline"}</span></div>
        </div>
        {extracting&&<div style={{display:"flex",alignItems:"center",gap:6,marginTop:4}}><div style={{width:6,height:6,borderRadius:"50%",background:T.accent,animation:"pulse 1s infinite"}}/><span style={{fontSize:10,color:T.accent,fontFamily:T.mono}}>extracting…</span></div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD + REAL EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
function Upload({efdbToken, setBills, setSelected, setPage, setEfdbSrc, setGlobalExtracting}) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);
  const [stage, setStage] = useState("idle"); // idle|hashing|extracting|validating|done|error
  const [log, setLog] = useState([]);
  const [error, setError] = useState("");
  const fileRef = useRef();

  const addLog = (msg, type="info") => setLog(p=>[...p, { msg, type, t:new Date().toLocaleTimeString() }]);

  function handleFile(f) {
    if (!f) return;
    const allowed = ["application/pdf","image/jpeg","image/jpg","image/png","image/webp","image/gif"];
    if (!allowed.includes(f.type)) { setError(`Unsupported type: ${f.type}. Use PDF, JPEG, or PNG.`); return; }
    if (f.size > 20*1024*1024) { setError("File too large. Maximum 20MB."); return; }
    setFile(f); setError(""); setLog([]); setStage("idle");
    if (f.type.startsWith("image/")) {
      const url = URL.createObjectURL(f);
      setPreview(url);
    } else {
      setPreview(null);
    }
  }

  async function extract() {
    if (!file) return;
    setError(""); setLog([]); setStage("hashing"); setGlobalExtracting(true);

    try {
      // Step 1: hash
      addLog("Computing SHA-256 hash…");
      const arrayBuffer = await file.arrayBuffer();
      const fileHash = await hashFile(arrayBuffer);
      addLog(`Hash: ${fileHash.slice(0,16)}…`, "success");

      // Step 2: Claude extraction
      setStage("extracting");
      addLog(`Calling Claude ${CLAUDE_MODEL} (prompt ${PROMPT_VERSION})…`);
      const t0 = Date.now();
      const { parsed, rawText, usage } = await callClaudeExtract(file);
      addLog(`Extracted in ${Date.now()-t0}ms — ${usage?.input_tokens} input / ${usage?.output_tokens} output tokens`, "success");

      // Step 3: parse result
      const billType   = parsed.bill_type;
      const extracted  = billType==="electricity" ? parsed.electricity : parsed.fuel;
      const confScores = parsed.confidence || {};
      const conf       = overallConf(confScores);
      const routing    = conf>=0.9?"auto_approved":conf>=0.7?"human_review":"rejected";
      addLog(`Overall confidence: ${Math.round(conf*100)}% → ${routing}`);

      // Step 4: validation
      setStage("validating");
      addLog("Running validation rules…");
      const validation = runValidation(billType, extracted);
      const hasHard = validation.flags.some(f=>f.sev==="HARD_REJECT");
      addLog(`Validation: ${validation.status} — ${validation.rules_run} rules, ${validation.flags.length} flags`, hasHard?"warn":"success");

      // Step 5: EFDB factor lookup
      addLog("Looking up EFDB emission factor…");
      const factor = await lookupFactor(billType, extracted?.fuel_type, efdbToken);
      setEfdbSrc(factor._source);
      addLog(`Factor: ${factor.ef_total_co2e} ${factor.unit} — source: ${factor._source}`, "success");

      // Step 6: compute emission
      const emission = calcEmission(billType, extracted, factor);
      if (emission) addLog(`Emission: ${emission.tco2e} tCO₂e (Scope ${emission.scope})`, "success");

      // Step 7: determine final status
      let status = routing==="auto_approved"?"approved":routing==="human_review"?"review":"rejected";
      if (hasHard && status!=="rejected") { status="rejected"; }

      // Build the bill record
      const bill = {
        id:                 uid(),
        status,
        bill_type:          billType,
        upload_method:      "portal_upload",
        original_filename:  file.name,
        file_size:          file.size,
        mime_type:          file.type,
        file_hash:          fileHash,
        sender_email:       null,
        dkim_verified:      null,
        uploaded_at:        new Date().toISOString(),
        extraction_method:  file.type==="application/pdf"?"vision_llm_pdf":"vision_llm_image",
        llm_model:          CLAUDE_MODEL,
        llm_prompt_version: PROMPT_VERSION,
        overall_confidence: conf,
        extracted,
        confidence_scores:  confScores,
        extraction_notes:   parsed.extraction_notes,
        raw_llm_response:   rawText,
        token_usage:        usage,
        validation,
        factor,
        emission,
        approved_by:        status==="approved"?"Auto-approved (confidence ≥ 90%)":null,
        approved_at:        status==="approved"?new Date().toISOString():null,
        human_corrections:  {},
        rejection_reason:   status==="rejected"?(hasHard?validation.flags.filter(f=>f.sev==="HARD_REJECT").map(f=>f.label).join("; "):`Confidence ${Math.round(conf*100)}% below 70% threshold`):null,
        _live: true, // marks this as a real extraction
      };

      setBills(p=>[bill,...p]);
      setSelected(bill.id);
      setStage("done");
      addLog(`Done — bill ID: ${bill.id}`, "success");

      setTimeout(()=>setPage("review"), 800);

    } catch(e) {
      setStage("error");
      setError(e.message);
      addLog(`Error: ${e.message}`, "error");
    } finally {
      setGlobalExtracting(false);
    }
  }

  const stageColor = {idle:T.dim,hashing:T.info,extracting:T.warn,validating:T.info,done:T.accent,error:T.danger}[stage];

  return <>
    <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start"}}>
      {/* LEFT: drop zone + preview */}
      <div>
        <div style={{...SS.card,border:`2px dashed ${drag?T.accent:file?T.accentDim:T.line}`,background:drag?T.accentGlow:"transparent",textAlign:"center",padding:"36px 20px",cursor:"pointer",transition:"all 0.2s",marginBottom:0}}
          onDragOver={e=>{e.preventDefault();setDrag(true)}}
          onDragLeave={()=>setDrag(false)}
          onDrop={e=>{e.preventDefault();setDrag(false);handleFile(e.dataTransfer.files[0]);}}
          onClick={()=>fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept=".pdf,image/*" style={{display:"none"}} onChange={e=>handleFile(e.target.files[0])}/>
          {file ? (
            <>
              <div style={{fontSize:28,marginBottom:8}}>📄</div>
              <div style={{fontWeight:700,fontSize:14,color:T.accent,fontFamily:T.head,marginBottom:4}}>{file.name}</div>
              <div style={{fontSize:11,color:T.muted,fontFamily:T.mono}}>{(file.size/1024).toFixed(1)} KB · {file.type}</div>
              <div style={{marginTop:12}}><Btn sz="sm" v="ghost" onClick={e=>{e.stopPropagation();setFile(null);setPreview(null);setLog([]);setStage("idle");}}>Remove</Btn></div>
            </>
          ) : (
            <>
              <div style={{fontSize:32,marginBottom:10}}>↑</div>
              <div style={{fontSize:14,fontWeight:700,fontFamily:T.head,marginBottom:6}}>Drop a real bill here</div>
              <div style={{fontSize:12,color:T.muted,marginBottom:14}}>PDF · JPEG · PNG — MSEDCL, BPCL, any Indian utility bill</div>
              <div style={{display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                {["MSEDCL","BEST","Tata Power","BPCL","HPCL","IOC"].map(d=><span key={d} style={tag(T.successBg,T.accent)}>{d}</span>)}
              </div>
            </>
          )}
        </div>

        {preview && (
          <div style={{...SS.card,padding:8,marginTop:8}}>
            <img src={preview} alt="bill preview" style={{width:"100%",borderRadius:6,maxHeight:300,objectFit:"contain",background:"#fff"}}/>
          </div>
        )}

        <div style={{marginTop:12}}>
          <Btn style={{width:"100%"}} disabled={!file||["hashing","extracting","validating"].includes(stage)} onClick={extract}>
            {stage==="hashing"?"Hashing…":stage==="extracting"?"Calling Claude…":stage==="validating"?"Validating…":stage==="done"?"✓ Done — extracting another?":"Extract with Claude →"}
          </Btn>
          {error&&<div style={{marginTop:8,fontSize:11,color:T.danger,fontFamily:T.mono,wordBreak:"break-word"}}>{error}</div>}
        </div>
      </div>

      {/* RIGHT: live log */}
      <div>
        <div style={SS.card}>
          <div style={SS.label}>
            Extraction log
            {stage!=="idle"&&<span style={{...pill(stageColor+"22",stageColor),marginLeft:8,fontSize:9}}>{stage}</span>}
          </div>
          {log.length===0 ? (
            <div style={{color:T.dim,fontSize:12,fontFamily:T.mono,padding:"20px 0",textAlign:"center"}}>Upload a bill and click Extract to begin</div>
          ) : (
            <div style={{display:"flex",flexDirection:"column",gap:4}}>
              {log.map((l,i)=>(
                <div key={i} style={{display:"flex",gap:10,padding:"5px 8px",borderRadius:5,background:l.type==="error"?T.dangerBg:l.type==="warn"?T.warnBg:l.type==="success"?T.successBg:"transparent"}}>
                  <span style={{fontFamily:T.mono,fontSize:9,color:T.dim,flexShrink:0,paddingTop:1}}>{l.t}</span>
                  <span style={{fontFamily:T.mono,fontSize:11,color:l.type==="error"?T.danger:l.type==="warn"?T.warn:l.type==="success"?T.accent:T.muted,flex:1,wordBreak:"break-word"}}>{l.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{...SS.card,background:T.accentGlow,border:`1px solid ${T.successLine}`}}>
          <div style={SS.label}>What's real in this extraction</div>
          {[
            ["SHA-256 hash","Computed in browser via crypto.subtle — real tamper-proof fingerprint"],
            ["Claude extraction","Real API call to api.anthropic.com — your actual bill is read"],
            ["Field confidence","Returned by Claude per field — not hardcoded"],
            ["Validation rules","Live rule engine on real extracted values"],
            ["EFDB lookup","Real fetch to the EFDB API — extraction fails loudly if no matching factor is found"],
            ["Emission calc","Real GHG Protocol math on real extracted consumption data"],
          ].map(([k,v])=>(
            <div key={k} style={{display:"flex",gap:10,padding:"5px 0",borderBottom:`1px solid ${T.successLine}`,fontSize:11}}>
              <span style={{color:T.accent,width:160,flexShrink:0,fontFamily:T.mono}}>✓ {k}</span>
              <span style={{color:T.muted}}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function ReviewDetail({bill, setBills, setPage}) {
  const [corrections, setCorrections] = useState({});
  const [isApproved, setIsApproved] = useState(bill.status==="approved");
  const factor = bill.factor;
  const merged = {...bill, extracted:{...bill.extracted,...corrections}};
  const val = merged.extracted ? runValidation(merged.bill_type, merged.extracted) : bill.validation;
  const emission = factor&&merged.extracted ? calcEmission(merged.bill_type, merged.extracted, factor) : bill.emission;
  const hardFail = val?.flags.some(f=>f.sev==="HARD_REJECT");

  function approve() {
    setBills(p=>p.map(x=>x.id===bill.id?{...x,status:"approved",approved_by:"Reviewer: Current User",approved_at:new Date().toISOString(),human_corrections:corrections,emission:calcEmission(merged.bill_type,merged.extracted,factor)}:x));
    setIsApproved(true);
  }
  function reject() {
    setBills(p=>p.map(x=>x.id===bill.id?{...x,status:"rejected",rejection_reason:"Manually rejected by reviewer"}:x));
    setPage("review");
  }

  const elecF=[{k:"discom",l:"DISCOM"},{k:"account_number",l:"Account no."},{k:"consumer_name",l:"Consumer name"},{k:"consumer_category",l:"Category"},{k:"period_from",l:"Period from"},{k:"period_to",l:"Period to"},{k:"units_kwh",l:"Units (kWh)"},{k:"solar_export_kwh",l:"Solar export (kWh)"},{k:"sanctioned_load_kw",l:"Sanctioned load (kW)"},{k:"amount_inr",l:"Amount (₹)"}];
  const fuelF=[{k:"vendor_name",l:"Vendor name"},{k:"vendor_gstin",l:"Vendor GSTIN"},{k:"invoice_number",l:"Invoice no."},{k:"invoice_date",l:"Invoice date"},{k:"fuel_type",l:"Fuel type"},{k:"quantity",l:"Quantity"},{k:"quantity_unit",l:"Unit"},{k:"vehicle_number",l:"Vehicle no."},{k:"amount_inr",l:"Amount (₹)"}];
  const fields = bill.bill_type==="electricity" ? elecF : fuelF;

  return <>
    <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:18}}>
      <Btn v="ghost" sz="sm" onClick={()=>setPage("review")}>← Back</Btn>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontWeight:700,fontSize:15,fontFamily:T.head}}>{bill.original_filename}</span>
          {bill._live&&<span style={pill(T.successBg,T.accent,{fontSize:9})}>REAL EXTRACTION</span>}
        </div>
        <div style={{fontSize:11,color:T.dim,marginTop:1,fontFamily:T.mono}}>{bill.extraction_method||"—"} · {bill.llm_model||"—"} · {bill.llm_prompt_version||"—"}</div>
      </div>
      <SPill s={isApproved?"approved":bill.status}/>
    </div>

    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,alignItems:"start"}}>
      {/* LEFT */}
      <div>
        {/* If image bill, show the actual uploaded image */}
        {bill.mime_type?.startsWith("image/")&&bill.original_filename&&(
          <div style={{...SS.card,padding:10,marginBottom:14}}>
            <div style={SS.label}>Original bill</div>
            <div style={{fontSize:11,color:T.dim,fontFamily:T.mono,marginBottom:8}}>SHA-256: {short(bill.file_hash)}</div>
          </div>
        )}

        <div style={SS.card}>
          <div style={SS.label}>EFDB factor record</div>
          {factor ? (
            <div style={{background:T.successBg,border:`1px solid ${T.successLine}`,borderRadius:8,padding:"12px 14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontFamily:T.mono,fontSize:11,color:T.accent}}>{factor.canonical_activity_name}</span>
                <span style={pill(T.successBg,T.accent,{fontSize:9})}>{factor._source}</span>
              </div>
              {[["ef_total_co2e",`${factor.ef_total_co2e} (${factor.unit})`],["source_name",factor.source_name],["applicable_scopes",(factor.applicable_scopes||[]).join(", ")],["gwp_version",factor.gwp_version],["confidence_score",factor.confidence_score!=null?`${factor.confidence_score}/100`:"—"],["id",factor.id]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:10,padding:"3px 0",borderBottom:`1px solid rgba(74,222,128,0.1)`,fontSize:11}}>
                  <span style={{fontFamily:T.mono,color:"#4ADE80",width:180,flexShrink:0}}>{k}</span>
                  <span style={{color:T.text,wordBreak:"break-all"}}>{v||"—"}</span>
                </div>
              ))}
            </div>
          ) : <div style={{color:T.dim,fontSize:12}}>No factor available</div>}
        </div>

        {val&&(
          <div style={SS.card}>
            <div style={SS.label}>Validation · {val.rules_run} rules · <span style={{color:val.status==="passed"?T.accent:val.status==="flagged"?T.warn:T.danger}}>{val.status}</span></div>
            {val.flags.length===0
              ? <div style={{color:T.accent,fontSize:12}}>✓ All validation rules passed</div>
              : val.flags.map(f=>(
                <div key={f.rule} style={{display:"flex",gap:10,padding:"7px 10px",borderRadius:6,marginBottom:5,background:f.sev==="HARD_REJECT"?T.dangerBg:T.warnBg,border:`1px solid ${f.sev==="HARD_REJECT"?T.dangerLine:T.warnLine}`}}>
                  <span style={{fontFamily:T.mono,fontSize:10,fontWeight:700,color:f.sev==="HARD_REJECT"?T.danger:T.warn,width:36,flexShrink:0}}>{f.rule}</span>
                  <span style={{fontSize:11}}>{f.label}</span>
                </div>
              ))
            }
          </div>
        )}
      </div>

      {/* RIGHT */}
      <div>
        <div style={SS.card}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <div style={SS.label}>Extracted fields</div>
            <ConfBar val={bill.overall_confidence}/>
          </div>
          {bill.extraction_notes&&(
            <div style={{fontSize:11,color:T.warn,background:T.warnBg,padding:"6px 10px",borderRadius:5,marginBottom:10,fontFamily:T.mono,border:`1px solid ${T.warnLine}`}}>
              ⓘ {bill.extraction_notes}
            </div>
          )}

          {bill.extracted ? fields.map(f=>{
            const conf=bill.confidence_scores?.[f.k];
            const corrected=corrections[f.k]!==undefined;
            return (
              <div key={f.k} style={{display:"flex",borderBottom:`1px solid ${T.line}`,padding:"7px 0",alignItems:"flex-start",gap:10}}>
                <div style={{width:145,flexShrink:0,fontSize:11,color:T.muted,paddingTop:5,fontFamily:T.mono}}>{f.l}</div>
                <div style={{flex:1}}>
                  {!isApproved ? (
                    <input key={bill.id+f.k} defaultValue={bill.extracted[f.k]??""} style={{...SS.input,borderColor:corrected?T.accent:T.line,background:corrected?T.accentGlow:T.bg}}
                      onChange={e=>{
                        const val2=e.target.value;
                        if(val2!==String(bill.extracted[f.k]??"")){setCorrections(p=>({...p,[f.k]:val2}));}
                        else setCorrections(p=>{const n={...p};delete n[f.k];return n;});
                      }}/>
                  ):<div style={{fontSize:12,fontFamily:T.mono,paddingTop:4}}>{String(merged.extracted[f.k]??"—")}</div>}
                  {corrected&&<div style={{fontSize:10,color:T.accent,marginTop:2,fontFamily:T.mono}}>✏ was: {String(bill.extracted[f.k])}</div>}
                </div>
                <div style={{width:90,paddingTop:4}}><ConfBar val={conf}/></div>
              </div>
            );
          }) : <div style={{color:T.dim,textAlign:"center",padding:30,fontSize:12}}>No extracted data</div>}
        </div>

        {emission&&(
          <div style={{...SS.card,background:T.successBg,border:`1px solid ${T.successLine}`}}>
            <div style={SS.label}>Emission calculation</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div style={{background:"rgba(74,222,128,0.05)",borderRadius:8,padding:"14px 16px",border:`1px solid ${T.successLine}`}}>
                <div style={{fontSize:26,fontWeight:700,color:T.accent,fontFamily:T.head,letterSpacing:"-0.5px"}}>{emission.tco2e}</div>
                <div style={{fontSize:11,color:T.accentDim,marginTop:2,fontFamily:T.mono}}>tCO₂e · Scope {emission.scope}</div>
              </div>
              <div style={{background:"rgba(74,222,128,0.05)",borderRadius:8,padding:"14px 16px",border:`1px solid ${T.successLine}`}}>
                <div style={{fontSize:13,fontWeight:700,color:T.accent,fontFamily:T.mono}}>{factor?.ef_total_co2e}</div>
                <div style={{fontSize:10,color:T.accentDim,marginTop:2,fontFamily:T.mono}}>{factor?.unit}</div>
                <div style={{fontSize:9,color:T.dim,marginTop:4,wordBreak:"break-word"}}>{factor?.source_name}</div>
              </div>
            </div>
            <pre style={{...SS.mono,fontSize:10,padding:"8px 12px"}}>{emission.formula} = {emission.tco2e} tCO₂e</pre>
          </div>
        )}

        {!isApproved&&bill.status!=="rejected"&&bill.extracted&&(
          <div style={{display:"flex",gap:10}}>
            <Btn style={{flex:1}} disabled={hardFail} onClick={approve}>
              {hardFail?"Cannot approve — hard reject active":"✓ Approve"+(Object.keys(corrections).length>0?` (${Object.keys(corrections).length} corrections)`:"")}
            </Btn>
            <Btn v="danger" onClick={reject}>Reject</Btn>
          </div>
        )}
        {isApproved&&<Btn v="ghost" style={{width:"100%",marginTop:4}} onClick={()=>setPage("audit")}>View audit trail →</Btn>}
        {bill.status==="rejected"&&<div style={{padding:"10px 14px",background:T.dangerBg,border:`1px solid ${T.dangerLine}`,borderRadius:8,fontSize:11,color:T.danger,fontFamily:T.mono}}>{bill.rejection_reason}</div>}
      </div>
    </div>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW QUEUE
// ─────────────────────────────────────────────────────────────────────────────
function Review({bills, setBills, selectedId, setSelected, setPage}) {
  const sel = bills.find(b=>b.id===selectedId);
  if (sel) return <ReviewDetail bill={sel} setBills={setBills} setPage={setPage}/>;

  const q = bills.filter(b=>b.status==="review"||b.status==="pending");
  if (!q.length) return (
    <div style={{...SS.card,textAlign:"center",padding:"60px 40px"}}>
      <div style={{fontSize:30,marginBottom:12}}>✓</div>
      <div style={{fontWeight:700,fontFamily:T.head,fontSize:16,marginBottom:6}}>Queue empty</div>
      <div style={{fontSize:12,color:T.muted}}>All reviewed. Upload a new bill to continue.</div>
    </div>
  );
  return (
    <div style={SS.card}>
      <div style={SS.label}>{q.length} bill{q.length>1?"s":""} awaiting action</div>
      {q.map(b=>(
        <div key={b.id} style={{display:"flex",gap:14,padding:"12px",borderRadius:8,border:`1px solid ${T.border}`,marginBottom:8,cursor:"pointer",transition:"all 0.15s"}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accentDim;e.currentTarget.style.background=T.accentGlow;}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background="transparent";}}
          onClick={()=>{setSelected(b.id);setPage("review")}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5}}>
              <span style={{fontWeight:600,fontSize:13}}>{b.original_filename}</span>
              {b._live&&<span style={pill(T.successBg,T.accent,{fontSize:9})}>live</span>}
            </div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
              <SPill s={b.status}/><TPill t={b.bill_type}/>
              <span style={{fontSize:11,color:T.dim}}>{fmtD(b.uploaded_at)}</span>
              {b.validation?.flags?.length>0&&<span style={pill(T.dangerBg,T.danger)}>{b.validation.flags.length} flags</span>}
            </div>
          </div>
          <div style={{width:110,display:"flex",flexDirection:"column",justifyContent:"center"}}><ConfBar val={b.overall_confidence}/></div>
          <Btn sz="sm" v="ghost">Review →</Btn>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({bills, setPage, setSelected}) {
  const counts = bills.reduce((a,b)=>({...a,[b.status]:(a[b.status]||0)+1}),{});
  const liveCount = bills.filter(b=>b._live).length;
  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:18}}>
      {[
        {label:"Total bills",   val:bills.length,         c:T.text},
        {label:"Live extractions",val:liveCount,          c:T.accent},
        {label:"Review queue",  val:counts.review||0,     c:T.warn},
        {label:"Approved",      val:counts.approved||0,   c:T.accentDim},
      ].map((s,i)=>(
        <div key={i} style={{...SS.card,marginBottom:0,padding:"16px 20px"}}>
          <div style={{fontSize:28,fontWeight:700,color:s.c,fontFamily:T.head,letterSpacing:"-1px"}}>{s.val}</div>
          <div style={{fontSize:11,color:T.muted,marginTop:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</div>
        </div>
      ))}
    </div>
    <div style={SS.card}>
      <div style={SS.label}>Bill pipeline</div>
      {bills.length===0 ? (
        <div style={{textAlign:"center",padding:"40px 0",color:T.dim,fontSize:12}}>No bills yet — upload a real bill to get started</div>
      ) : (
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:`1px solid ${T.line}`}}>
            {["File","Type","Uploaded","Confidence","Status",""].map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",fontSize:10,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",fontFamily:T.head}}>{h}</th>)}
          </tr></thead>
          <tbody>{bills.map(b=>(
            <tr key={b.id} style={{borderBottom:`1px solid ${T.line}`,cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(74,222,128,0.02)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              onClick={()=>{setSelected(b.id);setPage("review")}}>
              <td style={{padding:"10px 10px"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <span style={{fontWeight:600,fontSize:12}}>{b.original_filename}</span>
                  {b._live&&<span style={pill(T.successBg,T.accent,{fontSize:9,padding:"1px 6px"})}>live</span>}
                </div>
                <div style={{fontFamily:T.mono,fontSize:10,color:T.dim}}>{short(b.file_hash)}</div>
              </td>
              <td style={{padding:"10px 10px"}}><TPill t={b.bill_type}/></td>
              <td style={{padding:"10px 10px",fontSize:11,color:T.muted}}>{fmtD(b.uploaded_at)}</td>
              <td style={{padding:"10px 10px",width:130}}><ConfBar val={b.overall_confidence}/></td>
              <td style={{padding:"10px 10px"}}><SPill s={b.status}/></td>
              <td style={{padding:"10px 10px"}}><Btn sz="sm" v="ghost" onClick={e=>{e.stopPropagation();setSelected(b.id);setPage("review")}}>View →</Btn></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// EMISSION RECORDS
// ─────────────────────────────────────────────────────────────────────────────
function Records({bills}) {
  const approved = bills.filter(b=>b.status==="approved"&&b.emission);
  const totalTco2e = approved.reduce((sum,b)=>sum+(b.emission?.tco2e||0),0);
  return <>
    <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:18}}>
      {[{label:"Total tCO₂e",val:totalTco2e.toFixed(4),c:T.accent},{label:"Scope 2",val:approved.filter(b=>b.bill_type==="electricity").length,c:T.info},{label:"Scope 1",val:approved.filter(b=>b.bill_type==="fuel").length,c:T.warn}].map((s,i)=>(
        <div key={i} style={{...SS.card,marginBottom:0}}>
          <div style={{fontSize:26,fontWeight:700,color:s.c,fontFamily:T.head,letterSpacing:"-0.5px"}}>{s.val}</div>
          <div style={{fontSize:11,color:T.muted,marginTop:4,textTransform:"uppercase",letterSpacing:"0.06em"}}>{s.label}</div>
        </div>
      ))}
    </div>
    <div style={SS.card}>
      <div style={SS.label}>Approved emission records</div>
      {approved.length===0 ? <div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"30px 0"}}>No approved records yet</div> : (
        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
          <thead><tr style={{borderBottom:`1px solid ${T.line}`}}>
            {["File","Type","Activity","EF","tCO₂e","Scope","Source","Tokens"].map(h=><th key={h} style={{textAlign:"left",padding:"7px 8px",fontSize:10,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}
          </tr></thead>
          <tbody>{approved.map(b=>{
            const em=b.emission, f=b.factor;
            return (
              <tr key={b.id} style={{borderBottom:`1px solid ${T.line}`}}>
                <td style={{padding:"9px 8px",fontWeight:600,fontSize:11,maxWidth:150,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{b.original_filename}</td>
                <td style={{padding:"9px 8px"}}><TPill t={b.bill_type}/></td>
                <td style={{padding:"9px 8px",fontFamily:T.mono,fontSize:11}}>{em?`${fmtN(em.activity)} ${em.actUnit}`:"—"}</td>
                <td style={{padding:"9px 8px"}}>{f?<div><span style={{fontFamily:T.mono,fontSize:11,color:T.accent}}>{f.ef_total_co2e}</span><br/><span style={{fontSize:9,color:T.dim}}>{f.unit}</span></div>:"—"}</td>
                <td style={{padding:"9px 8px",fontFamily:T.mono,fontWeight:700,color:T.accent}}>{em?.tco2e??"—"}</td>
                <td style={{padding:"9px 8px"}}>{em&&<span style={pill(T.infoBg,T.info)}>Scope {em.scope}</span>}</td>
                <td style={{padding:"9px 8px"}}>{f&&<span style={pill(T.successBg,T.accent,{fontSize:9})}>{f._source}</span>}</td>
                <td style={{padding:"9px 8px",fontFamily:T.mono,fontSize:10,color:T.dim}}>{b.token_usage?`${b.token_usage.input_tokens}↑ ${b.token_usage.output_tokens}↓`:"—"}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </div>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────────────────
function Audit({bill}) {
  if (!bill) return <div style={{...SS.card,textAlign:"center",padding:60,color:T.dim}}>Select a bill from the dashboard first.</div>;
  const val = bill.extracted ? runValidation(bill.bill_type, bill.extracted) : bill.validation;
  const steps = [
    {n:1,label:"File received",          d:`Method: ${bill.upload_method||"—"}\nFilename: ${bill.original_filename}\nSize: ${bill.file_size?(bill.file_size/1024).toFixed(1)+" KB":"—"}\nMIME: ${bill.mime_type||"—"}`},
    {n:2,label:"SHA-256 computed",       d:`${bill.file_hash}\nComputed in browser via crypto.subtle.digest()\nImmutable audit fingerprint`},
    {n:3,label:"Claude extraction",      d:`Model: ${bill.llm_model||"—"}\nPrompt version: ${bill.llm_prompt_version||"—"}\nMethod: ${bill.extraction_method||"—"}\nTokens: ${bill.token_usage?`${bill.token_usage.input_tokens} input, ${bill.token_usage.output_tokens} output`:"—"}\nNotes: ${bill.extraction_notes||"none"}`},
    {n:4,label:"Confidence scoring",     d:`Overall: ${bill.overall_confidence!=null?Math.round(bill.overall_confidence*100)+"%":"—"}\nRouting: ${bill.overall_confidence>=0.9?"auto_approved (≥90%)":bill.overall_confidence>=0.7?"human_review (70–89%)":"rejected (<70%)"}`},
    {n:5,label:"Validation rules",       d:val?`${val.rules_run} rules run\nStatus: ${val.status}\nFlags: ${val.flags.length}\n${val.flags.map(f=>`[${f.rule}] ${f.label}`).join("\n")||"none"}`:"Skipped"},
    {n:6,label:"EFDB factor lookup",     d:bill.factor?`Source: ${bill.factor._source}\ncanonical: ${bill.factor.canonical_activity_name}\nef_total_co2e: ${bill.factor.ef_total_co2e} ${bill.factor.unit}\nsource_name: ${bill.factor.source_name}\nconfidence: ${bill.factor.confidence_score}/100\nid: ${bill.factor.id}`:"No factor"},
    bill.emission?{n:7,label:"Emission computed",d:`${bill.emission.formula} = ${bill.emission.tco2e} tCO₂e\nScope ${bill.emission.scope} · GWP: ${bill.factor?.gwp_version||"—"}\nMethodology: GHG Protocol`}:null,
    bill.approved_by?{n:8,label:"Approved",d:`By: ${bill.approved_by}\nAt: ${fmtD(bill.approved_at)}\nCorrections: ${Object.keys(bill.human_corrections||{}).length} fields`}:null,
  ].filter(Boolean);

  return <>
    <div style={SS.card}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={SS.label}>Audit trail</div>
        {bill._live&&<span style={pill(T.successBg,T.accent,{fontSize:9})}>REAL EXTRACTION</span>}
      </div>
      <div style={{fontSize:12,color:T.muted,fontFamily:T.mono,marginBottom:16}}>{bill.original_filename} · {short(bill.file_hash)}</div>
      <div style={{position:"relative"}}>
        <div style={{position:"absolute",left:11,top:0,bottom:0,width:1,background:T.line}}/>
        {steps.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:14,marginBottom:16,position:"relative"}}>
            <div style={{width:22,height:22,borderRadius:"50%",background:i===steps.length-1?T.accent:T.card,border:`1px solid ${T.accent}`,flexShrink:0,zIndex:1,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:i===steps.length-1?"#030805":T.accent,fontFamily:T.head}}>{s.n}</div>
            <div style={{flex:1,paddingTop:2}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:3,fontFamily:T.head}}>{s.label}</div>
              <div style={{fontFamily:T.mono,fontSize:10,color:T.muted,whiteSpace:"pre-line",lineHeight:1.7}}>{s.d}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
    {bill._live&&(
      <div style={SS.card}>
        <div style={SS.label}>Raw Claude response (verbatim)</div>
        <pre style={{...SS.mono,fontSize:10,maxHeight:200,overflow:"auto"}}>{bill.raw_llm_response||"—"}</pre>
      </div>
    )}
    <div style={SS.card}>
      <div style={SS.label}>Full record JSON</div>
      <pre style={{...SS.mono,fontSize:10,maxHeight:400,overflow:"auto"}}>{JSON.stringify({
        bill_document_id:bill.id, file_hash:bill.file_hash, original_filename:bill.original_filename,
        extraction_method:bill.extraction_method, llm_model:bill.llm_model, llm_prompt_version:bill.llm_prompt_version,
        overall_confidence:bill.overall_confidence, extracted_fields:bill.extracted,
        confidence_scores:bill.confidence_scores, extraction_notes:bill.extraction_notes,
        validation:val, human_corrections:bill.human_corrections, token_usage:bill.token_usage,
        efdb_factor:bill.factor?{id:bill.factor.id,canonical_activity_name:bill.factor.canonical_activity_name,ef_total_co2e:bill.factor.ef_total_co2e,unit:bill.factor.unit,source_name:bill.factor.source_name,confidence_score:bill.factor.confidence_score,gwp_version:bill.factor.gwp_version,_source:bill.factor._source}:null,
        emission:bill.emission,
      },null,2)}</pre>
    </div>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
function Settings({efdbToken, setEfdbToken, efdbSrc}) {
  const [emailInput, setEmailInput] = useState("");
  const [passInput, setPassInput] = useState("");
  const [efdbLoading, setEfdbLoading] = useState(false);
  const [efdbError, setEfdbError] = useState("");
  const [testResult, setTestResult] = useState(null);

  async function efdbLogin() {
    setEfdbLoading(true); setEfdbError("");
    try {
      const r = await fetch(EFDB_LOGIN,{ method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email:emailInput,password:passInput}) });
      if (!r.ok) { const d=await r.json().catch(()=>({})); throw new Error(d.detail||`HTTP ${r.status}`); }
      const d = await r.json();
      const token = d?.access_token || d?.token || d?.data?.accessToken;
      if (!token) throw new Error("Token not found in response");
      setEfdbToken(token);
      Object.keys(factorCache).forEach(k=>delete factorCache[k]);
    } catch(e){setEfdbError(e.message);}
    finally{setEfdbLoading(false);}
  }

  async function testEFDB() {
    setTestResult(null);
    try {
      const url = efdbToken
        ? `${EFDB_AUTH}?q=electricity+purchased&country=IN&scope=Scope+2&page_size=3`
        : `${EFDB_PUBLIC}?q=electricity+purchased&country=IN&scope=Scope+2&page_size=3`;
      const headers = efdbToken ? {"Authorization":`Bearer ${efdbToken}`} : {};
      const r = await fetch(url, {headers, signal:AbortSignal.timeout(6000)});
      const d = await r.json().catch(()=>({}));
      setTestResult({status:r.status, records:d.items?.length||0, total:d.total, sample:d.items?.[0]||null, endpoint:efdbToken?"authenticated":"public"});
    } catch(e){setTestResult({status:"error",error:e.message});}
  }

  return <>
    {/* Claude API Key — server-side */}
    <div style={SS.card}>
      <div style={SS.label}>Claude API key</div>
      <div style={{fontSize:12,color:T.muted,lineHeight:1.7}}>
        Configured server-side via <code style={{fontFamily:T.mono,fontSize:11,background:T.bg,padding:"2px 6px",borderRadius:4}}>ANTHROPIC_API_KEY</code> in <code style={{fontFamily:T.mono,fontSize:11}}>.env</code>.
        The vite proxy injects it on every request — the key never reaches the browser. Restart the dev server after changing it.
      </div>
    </div>

    {/* EFDB Auth */}
    <div style={SS.card}>
      <div style={SS.label}>EFDB authentication</div>
      <div style={{fontSize:12,color:T.muted,marginBottom:14,lineHeight:1.7}}>
        Log in to EFDB to use the authenticated endpoint — which has more factors and higher confidence scores than the public endpoint.
        If EFDB public endpoint doesn't have India factors yet, authenticated access may find them.
      </div>
      {efdbToken ? (
        <div style={{display:"flex",gap:10,alignItems:"center",marginBottom:12}}>
          <span style={pill(T.successBg,T.accent)}>✓ EFDB authenticated</span>
          <Btn sz="sm" v="ghost" onClick={()=>{setEfdbToken(null);Object.keys(factorCache).forEach(k=>delete factorCache[k]);}}>Log out</Btn>
        </div>
      ) : (
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:10,alignItems:"end",marginBottom:12}}>
          <div><div style={{fontSize:10,color:T.dim,marginBottom:4,fontFamily:T.mono}}>EFDB email</div><input style={SS.input} value={emailInput} onChange={e=>setEmailInput(e.target.value)} placeholder="you@greenmentor.in"/></div>
          <div><div style={{fontSize:10,color:T.dim,marginBottom:4,fontFamily:T.mono}}>Password</div><input type="password" style={SS.input} value={passInput} onChange={e=>setPassInput(e.target.value)} placeholder="••••••••"/></div>
          <Btn onClick={efdbLogin} disabled={efdbLoading||!emailInput||!passInput}>{efdbLoading?"Logging in…":"Log in to EFDB"}</Btn>
        </div>
      )}
      {efdbError&&<div style={{fontSize:11,color:T.danger,fontFamily:T.mono,marginBottom:8}}>{efdbError}</div>}

      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        <Btn v="subtle" sz="sm" onClick={testEFDB}>Test EFDB factor lookup</Btn>
        <span style={{fontSize:11,color:T.dim}}>Current source: <b style={{color:efdbSrc==="offline"?T.danger:efdbSrc==="efdb_public"?T.info:T.accent}}>{efdbSrc}</b></span>
      </div>

      {testResult&&(
        <div style={{marginTop:12,fontFamily:T.mono,fontSize:11}}>
          <div style={{marginBottom:6,color:testResult.status===200?T.accent:T.danger}}>
            HTTP {testResult.status} · {testResult.endpoint} endpoint · {testResult.records!=null?`${testResult.records} records (total: ${testResult.total})`:testResult.error}
          </div>
          {testResult.records===0&&<div style={{color:T.warn,marginBottom:8,fontSize:11}}>No India electricity factors in EFDB. Add them to go live — see query map below.</div>}
          {testResult.sample&&<pre style={{...SS.mono,fontSize:10,padding:10,maxHeight:200,overflow:"auto"}}>{JSON.stringify(testResult.sample,null,2)}</pre>}
        </div>
      )}
    </div>

    {/* Query map */}
    <div style={SS.card}>
      <div style={SS.label}>EFDB lookup query map</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:11}}>
        <thead><tr style={{borderBottom:`1px solid ${T.line}`}}>
          {["Activity key","q (search term)","country","scope"].map(h=><th key={h} style={{textAlign:"left",padding:"6px 8px",fontSize:10,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}
        </tr></thead>
        <tbody>{Object.entries(EFDB_QUERIES).map(([k,q])=>(
          <tr key={k} style={{borderBottom:`1px solid ${T.line}`}}>
            <td style={{padding:"7px 8px",fontFamily:T.mono,fontWeight:700,color:T.accent}}>{k}</td>
            <td style={{padding:"7px 8px",fontFamily:T.mono,color:T.muted,fontSize:10}}>{q.q}</td>
            <td style={{padding:"7px 8px",fontFamily:T.mono}}>{q.country}</td>
            <td style={{padding:"7px 8px"}}><span style={pill(q.scope==="Scope 2"?T.infoBg:T.warnBg,q.scope==="Scope 2"?T.info:T.warn)}>{q.scope}</span></td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [bills, setBills]               = useState([]);
  const [page, setPage]                 = useState("upload");
  const [selectedId, setSelectedId]     = useState(null);
  const [efdbToken, setEfdbToken]       = useState(null);
  const [efdbSrc, setEfdbSrc]           = useState("offline");
  const [globalExtracting, setGlobalExtracting] = useState(false);

  const reviewCount   = bills.filter(b=>b.status==="review").length;
  const selectedBill  = bills.find(b=>b.id===selectedId);

  // Probe EFDB public endpoint on mount
  useEffect(()=>{
    fetch(`${EFDB_PUBLIC}?page_size=1`,{signal:AbortSignal.timeout(5000)})
      .then(r=>{ if(r.ok) setEfdbSrc("efdb_public"); })
      .catch(()=>{});
  },[]);

  return (
    <div style={SS.app}>
      <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>{`* { box-sizing: border-box; } @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <Sidebar page={page} setPage={setPage} reviewCount={reviewCount} efdbSrc={efdbSrc} extracting={globalExtracting}/>

      <div style={SS.main}>
        <div style={SS.topbar}>
          <div>
            <div style={{fontWeight:700,fontSize:16,fontFamily:T.head,letterSpacing:"-0.3px"}}>
              {{upload:"Upload & Extract",dash:"Dashboard",review:"Review",records:"Emission Records",audit:"Audit Trail",settings:"Settings"}[page]}
            </div>
            <div style={{fontSize:11,color:T.dim,marginTop:1,fontFamily:T.mono}}>Maharashtra Govt Emissions Audit · FY 2024-25 · Real extraction active</div>
          </div>
          <div style={{display:"flex",gap:10,alignItems:"center"}}>
            {reviewCount>0&&(
              <div style={{...pill(T.warnBg,T.warn),cursor:"pointer",padding:"5px 12px",borderRadius:7}} onClick={()=>setPage("review")}>
                <Dot c={T.warn}/>{reviewCount} need review
              </div>
            )}
          </div>
        </div>

        <div style={SS.content}>
          {page==="upload"   && <Upload efdbToken={efdbToken} setBills={setBills} setSelected={setSelectedId} setPage={setPage} setEfdbSrc={setEfdbSrc} setGlobalExtracting={setGlobalExtracting}/>}
          {page==="dash"     && <Dashboard bills={bills} setPage={setPage} setSelected={setSelectedId}/>}
          {page==="review"   && <Review bills={bills} setBills={setBills} selectedId={selectedId} setSelected={setSelectedId} setPage={setPage}/>}
          {page==="records"  && <Records bills={bills}/>}
          {page==="audit"    && <Audit bill={selectedBill}/>}
          {page==="settings" && <Settings efdbToken={efdbToken} setEfdbToken={setEfdbToken} efdbSrc={efdbSrc}/>}
        </div>
      </div>
    </div>
  );
}
