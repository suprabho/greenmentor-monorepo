import { T, SS, pill } from "../theme.js";
import { CLAUDE_MODEL } from "../lib/claude.js";

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────
export const NAV=[{id:"dash",icon:"◈",label:"Dashboard"},{id:"upload",icon:"↑",label:"Upload bills"},{id:"review",icon:"⊡",label:"Review queue"},{id:"records",icon:"◉",label:"Emission records"},{id:"audit",icon:"⊞",label:"Audit trail"},{id:"settings",icon:"⬡",label:"Settings"}];

export default function Sidebar({page,setPage,reviewCount,efdbSrc,extracting}) {
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
