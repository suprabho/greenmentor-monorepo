import { T, SS, pill } from "../theme.js";
import { TPill } from "../components/ui.jsx";
import { fmtN } from "../lib/format.js";

// ─────────────────────────────────────────────────────────────────────────────
// EMISSION RECORDS
// ─────────────────────────────────────────────────────────────────────────────
export default function Records({bills}) {
  // Include all approved bills — even those without an EFDB factor/emission.
  // Those rows show "—" for EF/tCO₂e instead of being dropped from the registry.
  const approved = bills.filter(b=>b.status==="approved");
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
