import { T, SS, pill } from "../theme.js";
import { Btn, SPill, TPill, ConfBar } from "../components/ui.jsx";
import { fmtD, short } from "../lib/format.js";

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
export default function Dashboard({bills, setPage, setSelected}) {
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
