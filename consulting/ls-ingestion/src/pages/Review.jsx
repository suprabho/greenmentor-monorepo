import { useState } from "react";
import { T, SS, pill } from "../theme.js";
import { Btn, ConfBar, SPill, TPill } from "../components/ui.jsx";
import { runValidation } from "../lib/validation.js";
import { calcEmission } from "../lib/emission.js";
import { lookupFactor, factorQuery } from "../lib/efdb.js";
import { updateBillEF } from "../lib/sheets.js";
import { fmtD, short } from "../lib/format.js";

// ─────────────────────────────────────────────────────────────────────────────
// REVIEW DETAIL
// ─────────────────────────────────────────────────────────────────────────────
function ReviewDetail({bill, setBills, setPage, efdbToken, setEfdbSrc}) {
  const [corrections, setCorrections] = useState({});
  const [isApproved, setIsApproved] = useState(bill.status==="approved");
  const [looking, setLooking] = useState(false);
  const [lookupErr, setLookupErr] = useState("");
  const factor = bill.factor;
  const merged = {...bill, extracted:{...bill.extracted,...corrections}};
  const val = merged.extracted ? runValidation(merged.bill_type, merged.extracted) : bill.validation;
  const emission = factor&&merged.extracted ? calcEmission(merged.bill_type, merged.extracted, factor) : bill.emission;
  const hardFail = val?.flags.some(f=>f.sev==="HARD_REJECT");

  // Step 2: look up the EFDB emission factor for the (corrected) extracted data,
  // then compute the emission and backfill the persisted sheet row. Non-fatal —
  // a missing/unreachable factor surfaces an error and leaves the extraction intact.
  const fq = factorQuery(merged.bill_type, merged.extracted);
  async function lookupEF() {
    setLooking(true); setLookupErr("");
    try {
      const f = await lookupFactor(merged.bill_type, merged.extracted, efdbToken);
      const em = calcEmission(merged.bill_type, merged.extracted, f);
      const updated = {...bill, factor:f, emission:em};
      setBills(p=>p.map(x=>x.id===bill.id?updated:x));
      setEfdbSrc?.(f._source);
      try { await updateBillEF(updated); } catch(_) {} // sheet backfill — non-fatal
    } catch(e) {
      setEfdbSrc?.("offline");
      setLookupErr(e.message);
    } finally { setLooking(false); }
  }

  function approve() {
    setBills(p=>p.map(x=>x.id===bill.id?{...x,status:"approved",approved_by:"Reviewer: Current User",approved_at:new Date().toISOString(),human_corrections:corrections,emission:calcEmission(merged.bill_type,merged.extracted,factor)}:x));
    setIsApproved(true);
  }
  function reject() {
    setBills(p=>p.map(x=>x.id===bill.id?{...x,status:"rejected",rejection_reason:"Manually rejected by reviewer"}:x));
    setPage("review");
  }

  const elecF=[{k:"discom",l:"DISCOM"},{k:"electricity_source",l:"Electricity source"},{k:"source_type",l:"Source type"},{k:"transaction_type",l:"Transaction type"},{k:"account_number",l:"Account no."},{k:"consumer_name",l:"Consumer name"},{k:"consumer_category",l:"Category"},{k:"period_from",l:"Period from"},{k:"period_to",l:"Period to"},{k:"units_kwh",l:"Units (kWh)"},{k:"solar_export_kwh",l:"Solar export (kWh)"},{k:"sanctioned_load_kw",l:"Sanctioned load (kW)"},{k:"amount_inr",l:"Amount (₹)"}];
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
              {[["ef_value",`${factor.ef_value} ${factor.unit}`],["ghg_species",factor.ghg_species],["scope",factor.ghg_scope!=null?`Scope ${factor.ghg_scope}`:"—"],["gwp_basis",factor.gwp_basis],["source",factor.source_organization],["reference_year",factor.reference_year],["country_iso",factor.country_iso],["dq_score",factor.dq_score_overall!=null?`${factor.dq_score_overall}/5 (1=best)`:"—"],["id",factor.id]].map(([k,v])=>(
                <div key={k} style={{display:"flex",gap:10,padding:"3px 0",borderBottom:`1px solid rgba(74,222,128,0.1)`,fontSize:11}}>
                  <span style={{fontFamily:T.mono,color:"#4ADE80",width:180,flexShrink:0}}>{k}</span>
                  <span style={{color:T.text,wordBreak:"break-all"}}>{v||"—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{fontSize:11,color:T.muted,lineHeight:1.6,marginBottom:10}}>
                Step 2 — look up the EFDB emission factor for this bill's activity, using the
                {Object.keys(corrections).length>0 ? <b style={{color:T.accent}}> corrected </b> : " "}
                extracted data. Edit the fields first if needed, then run the lookup.
              </div>
              {fq.qp ? (
                <div style={{fontSize:10,color:T.dim,fontFamily:T.mono,marginBottom:10}}>
                  query: q="{fq.q}" · country={fq.country} · {fq.scope}
                </div>
              ) : (
                <div style={{fontSize:10,color:T.warn,fontFamily:T.mono,marginBottom:10}}>
                  No EFDB query mapping for "{fq.key}" — set a fuel type that maps to a factor.
                </div>
              )}
              <Btn sz="sm" disabled={looking||!fq.qp||!merged.extracted} onClick={lookupEF}>
                {looking ? "Looking up…" : "🔎 Look up emission factor"}
              </Btn>
              {lookupErr && (
                <div style={{marginTop:10,padding:"8px 10px",background:T.dangerBg,border:`1px solid ${T.dangerLine}`,borderRadius:6,fontSize:10,color:T.danger,fontFamily:T.mono,wordBreak:"break-word"}}>
                  {lookupErr}
                </div>
              )}
            </div>
          )}
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
export default function Review({bills, setBills, selectedId, setSelected, setPage, efdbToken, setEfdbSrc}) {
  const sel = bills.find(b=>b.id===selectedId);
  if (sel) return <ReviewDetail bill={sel} setBills={setBills} setPage={setPage} efdbToken={efdbToken} setEfdbSrc={setEfdbSrc}/>;

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
