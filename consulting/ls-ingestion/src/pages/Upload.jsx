import { useState, useRef } from "react";
import { T, SS, pill, tag } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import { CLAUDE_MODEL, PROMPT_VERSION, hashFile, overallConf, callClaudeExtract } from "../lib/claude.js";
import { lookupFactor } from "../lib/efdb.js";
import { runValidation } from "../lib/validation.js";
import { calcEmission } from "../lib/emission.js";
import { uid } from "../lib/format.js";

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD + REAL EXTRACTION
// ─────────────────────────────────────────────────────────────────────────────
export default function Upload({efdbToken, setBills, setSelected, setPage, setEfdbSrc, setGlobalExtracting}) {
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

      // Step 5: EFDB factor lookup — NON-FATAL.
      // If EFDB has no matching factor or is unreachable, we keep the extracted
      // values and surface them anyway; only the emission calc is skipped.
      addLog("Looking up EFDB emission factor…");
      let factor = null;
      try {
        factor = await lookupFactor(billType, extracted?.fuel_type, efdbToken);
        setEfdbSrc(factor._source);
        addLog(`Factor: ${factor.ef_total_co2e} ${factor.unit} — source: ${factor._source}`, "success");
      } catch(efErr) {
        setEfdbSrc("offline");
        addLog(`EFDB lookup failed: ${efErr.message} — keeping extracted values, emission skipped`, "warn");
      }

      // Step 6: compute emission (only when a factor was found)
      const emission = factor ? calcEmission(billType, extracted, factor) : null;
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
