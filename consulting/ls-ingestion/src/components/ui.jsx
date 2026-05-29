import { T, pill } from "../theme.js";

// ─────────────────────────────────────────────────────────────────────────────
// BASE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
export const Dot = ({c,s=6}) => <span style={{width:s,height:s,borderRadius:"50%",background:c,display:"inline-block",flexShrink:0}}/>;

export function Btn({v="primary",sz="md",disabled,onClick,children,style={}}) {
  const base={padding:sz==="sm"?"4px 12px":"8px 18px",borderRadius:7,cursor:disabled?"not-allowed":"pointer",fontFamily:T.body,fontSize:sz==="sm"?11:13,fontWeight:600,opacity:disabled?0.4:1,transition:"all 0.15s",border:"none",letterSpacing:"0.01em",...style};
  const vs={primary:{background:T.accent,color:"#030805"},danger:{background:T.danger,color:"#1a0606"},ghost:{background:"transparent",color:T.muted,border:`1px solid ${T.line}`},subtle:{background:T.card,color:T.text,border:`1px solid ${T.border}`}};
  return <button style={{...base,...vs[v]}} onClick={disabled?undefined:onClick} disabled={disabled}>{children}</button>;
}

export function ConfBar({val}) {
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
export const SPill=({s})=>{const m=STATUS[s]||STATUS.pending;return<span style={pill(m.bg,m.c)}><Dot c={m.dot}/>{m.l}</span>;};
export const TPill=({t})=><span style={pill(t==="electricity"?T.successBg:T.warnBg,t==="electricity"?T.accent:T.warn)}>{t||"unknown"}</span>;
