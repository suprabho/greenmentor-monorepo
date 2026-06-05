import { T, SS, pill } from "../theme.js";
import { SPill, TPill, ConfBar } from "../components/ui.jsx";
import { runValidation } from "../lib/validation.js";
import { fmtD, short } from "../lib/format.js";

// ─────────────────────────────────────────────────────────────────────────────
// AUDIT TRAIL
// ─────────────────────────────────────────────────────────────────────────────
export default function Audit({bill, bills=[], setSelected}) {
  // No specific bill selected → show the consolidated trail of every Claude call.
  if (!bill) return <AuditList bills={bills} setSelected={setSelected}/>;
  const val = bill.extracted ? runValidation(bill.bill_type, bill.extracted) : bill.validation;
  const steps = [
    {n:1,label:"File received",          d:`Method: ${bill.upload_method||"—"}\nFilename: ${bill.original_filename}\nSize: ${bill.file_size?(bill.file_size/1024).toFixed(1)+" KB":"—"}\nMIME: ${bill.mime_type||"—"}`},
    {n:2,label:"SHA-256 computed",       d:`${bill.file_hash}\nComputed in browser via crypto.subtle.digest()\nImmutable audit fingerprint`},
    {n:3,label:"Claude extraction",      d:`Model: ${bill.llm_model||"—"}\nPrompt version: ${bill.llm_prompt_version||"—"}\nMethod: ${bill.extraction_method||"—"}\nTokens: ${bill.token_usage?`${bill.token_usage.input_tokens} input, ${bill.token_usage.output_tokens} output`:"—"}\nNotes: ${bill.extraction_notes||"none"}`},
    {n:4,label:"Confidence scoring",     d:`Overall: ${bill.overall_confidence!=null?Math.round(bill.overall_confidence*100)+"%":"—"}\nRouting: ${bill.overall_confidence>=0.9?"auto_approved (≥90%)":bill.overall_confidence>=0.7?"human_review (70–89%)":"rejected (<70%)"}`},
    {n:5,label:"Validation rules",       d:val?`${val.rules_run} rules run\nStatus: ${val.status}\nFlags: ${val.flags.length}\n${val.flags.map(f=>`[${f.rule}] ${f.label}`).join("\n")||"none"}`:"Skipped"},
    {n:6,label:"EFDB factor lookup",     d:bill.factor?`Source: ${bill.factor._source}\nactivity_name: ${bill.factor.activity_name}\nef_value: ${bill.factor.ef_value} ${bill.factor.unit}\nsource_organization: ${bill.factor.source_organization}\nghg_scope: ${bill.factor.ghg_scope!=null?`Scope ${bill.factor.ghg_scope}`:"—"}\ndq_score_overall: ${bill.factor.dq_score_overall!=null?`${bill.factor.dq_score_overall}/5 (1=best)`:"—"}\nid: ${bill.factor.id}`:"No factor"},
    bill.emission?{n:7,label:"Emission computed",d:`${bill.emission.formula} = ${bill.emission.tco2e} tCO₂e\nScope ${bill.emission.scope} · GWP: ${bill.factor?.gwp_basis||"—"}\nMethodology: GHG Protocol`}:null,
    bill.approved_by?{n:8,label:"Approved",d:`By: ${bill.approved_by}\nAt: ${fmtD(bill.approved_at)}\nCorrections: ${Object.keys(bill.human_corrections||{}).length} fields`}:null,
  ].filter(Boolean);

  return <>
    {setSelected&&(
      <div onClick={()=>setSelected(null)} style={{display:"inline-flex",alignItems:"center",gap:6,cursor:"pointer",color:T.muted,fontSize:11,fontFamily:T.mono,marginBottom:12}}>
        ← All extractions
      </div>
    )}
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
        efdb_factor:bill.factor?{id:bill.factor.id,activity_name:bill.factor.activity_name,ef_value:bill.factor.ef_value,numerator_unit:bill.factor.numerator_unit,denominator_unit:bill.factor.denominator_unit,ghg_scope:bill.factor.ghg_scope,source_organization:bill.factor.source_organization,gwp_basis:bill.factor.gwp_basis,dq_score_overall:bill.factor.dq_score_overall,_source:bill.factor._source}:null,
        emission:bill.emission,
      },null,2)}</pre>
    </div>
  </>;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSOLIDATED CLAUDE TRAIL — every extraction this session, newest first.
// Each row drills into the per-bill audit detail above via setSelected(id).
// ─────────────────────────────────────────────────────────────────────────────
function AuditList({bills=[], setSelected}) {
  const rows = [...bills].sort((a,b)=>(b.uploaded_at||"").localeCompare(a.uploaded_at||""));
  if (!rows.length) return <div style={{...SS.card,textAlign:"center",padding:60,color:T.dim}}>No Claude extractions yet — upload a bill to start the trail.</div>;
  const cols = ["File","Type","Extracted at","Model","Prompt","Confidence","Status","Tokens"];
  return (
    <div style={SS.card}>
      <div style={SS.label}>Claude extraction trail · {rows.length} call{rows.length>1?"s":""}</div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
        <thead><tr style={{borderBottom:`1px solid ${T.line}`}}>
          {cols.map(h=><th key={h} style={{textAlign:"left",padding:"7px 8px",fontSize:10,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}
        </tr></thead>
        <tbody>{rows.map(b=>(
          <tr key={b.id} style={{borderBottom:`1px solid ${T.line}`,cursor:"pointer"}}
            onClick={()=>setSelected?.(b.id)}
            onMouseEnter={e=>{e.currentTarget.style.background=T.accentGlow;}}
            onMouseLeave={e=>{e.currentTarget.style.background="transparent";}}>
            <td style={{padding:"9px 8px",fontWeight:600,fontSize:11,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {b.original_filename}
              {b._live&&<span style={{...pill(T.successBg,T.accent,{fontSize:8}),marginLeft:6}}>live</span>}
            </td>
            <td style={{padding:"9px 8px"}}><TPill t={b.bill_type}/></td>
            <td style={{padding:"9px 8px",fontFamily:T.mono,fontSize:11,color:T.muted}}>{fmtD(b.uploaded_at)}</td>
            <td style={{padding:"9px 8px",fontFamily:T.mono,fontSize:10,color:T.muted}}>{b.llm_model||"—"}</td>
            <td style={{padding:"9px 8px",fontFamily:T.mono,fontSize:10,color:T.dim}}>{b.llm_prompt_version||"—"}</td>
            <td style={{padding:"9px 8px",minWidth:100}}><ConfBar val={b.overall_confidence}/></td>
            <td style={{padding:"9px 8px"}}><SPill s={b.status}/></td>
            <td style={{padding:"9px 8px",fontFamily:T.mono,fontSize:10,color:T.dim}}>{b.token_usage?`${b.token_usage.input_tokens}↑ ${b.token_usage.output_tokens}↓`:"—"}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
