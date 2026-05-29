import { useState, useEffect, useCallback } from "react";
import { T, SS, pill } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import { SHEET_SCHEMAS, fetchSheet } from "../lib/sheets.js";
import { supabaseConfigured } from "../lib/supabase.js";

// ─────────────────────────────────────────────────────────────────────────────
// SHEETS — live tables of stored bills, one tab per type, read from Supabase.
// Columns and table names come from SHEET_SCHEMAS (shared with the writer).
// ─────────────────────────────────────────────────────────────────────────────
export default function Sheets() {
  const [type, setType]   = useState("fuel");
  const [rows, setRows]   = useState([]);
  const [loading, setLoad]= useState(false);
  const [error, setError] = useState("");

  const schema = SHEET_SCHEMAS[type];

  const load = useCallback(async () => {
    if (!supabaseConfigured) { setError("Supabase not configured — set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env"); return; }
    setLoad(true); setError("");
    try { setRows(await fetchSheet(type)); }
    catch(e) { setError(e.message); setRows([]); }
    finally { setLoad(false); }
  }, [type]);

  useEffect(()=>{ load(); }, [load]);

  const fmt = (v) => v===null || v===undefined || v==="" ? "—" : String(v);

  return <>
    <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
      {Object.entries(SHEET_SCHEMAS).map(([k,s])=>(
        <span key={k} onClick={()=>setType(k)}
          style={{...pill(type===k?T.successBg:"transparent",type===k?T.accent:T.muted,{cursor:"pointer",border:`1px solid ${type===k?T.successLine:T.line}`,padding:"5px 14px"})}}>
          {s.label}
        </span>
      ))}
      <div style={{flex:1}}/>
      <Btn sz="sm" v="ghost" disabled={loading} onClick={load}>{loading?"Loading…":"↻ Refresh"}</Btn>
    </div>

    <div style={SS.card}>
      <div style={SS.label}>{schema.label} sheet · {rows.length} {rows.length===1?"row":"rows"}</div>
      {error ? (
        <div style={{color:T.danger,fontSize:12,fontFamily:T.mono,padding:"20px 0",textAlign:"center"}}>{error}</div>
      ) : rows.length===0 ? (
        <div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"30px 0"}}>{loading?"Loading…":`No ${schema.label.toLowerCase()} rows yet — upload a bill to populate this sheet`}</div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,whiteSpace:"nowrap"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.line}`}}>
              {schema.columns.map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",fontSize:10,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}
            </tr></thead>
            <tbody>{rows.map(r=>(
              <tr key={r.id} style={{borderBottom:`1px solid ${T.line}`}}>
                {schema.columns.map(c=><td key={c} style={{padding:"9px 10px",fontFamily:T.mono,fontSize:11,color:r[c]==null?T.dim:T.text}}>{fmt(r[c])}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  </>;
}
