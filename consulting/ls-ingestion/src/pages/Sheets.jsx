import { useState, useEffect, useCallback, useMemo } from "react";
import { T, SS, pill } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import { SHEET_SCHEMAS, fetchSheet, sheetRowsToCSV } from "../lib/sheets.js";
import { supabaseConfigured } from "../lib/supabase.js";

// ─────────────────────────────────────────────────────────────────────────────
// SHEETS — live tables of stored bills, one tab per type, read from Supabase.
// Columns and table names come from SHEET_SCHEMAS (shared with the writer).
// Rows can be filtered (free-text across template columns), selected, and
// downloaded as a CSV matching the bulk-upload template (sheetRowsToCSV).
// ─────────────────────────────────────────────────────────────────────────────
export default function Sheets() {
  const [type, setType]   = useState("fuel");
  const [rows, setRows]   = useState([]);
  const [loading, setLoad]= useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSel]= useState(() => new Set()); // selected row ids

  const schema = SHEET_SCHEMAS[type];

  const load = useCallback(async () => {
    if (!supabaseConfigured) { setError("Supabase not configured — set VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env"); return; }
    setLoad(true); setError("");
    try { setRows(await fetchSheet(type)); }
    catch(e) { setError(e.message); setRows([]); }
    finally { setLoad(false); }
  }, [type]);

  useEffect(()=>{ load(); }, [load]);
  // Clear filter + selection whenever the active sheet changes or it reloads.
  useEffect(()=>{ setQuery(""); setSel(new Set()); }, [type, rows]);

  const fmt = (v) => v===null || v===undefined || v==="" ? "—" : String(v);

  // Free-text filter across the template columns (case-insensitive substring).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => schema.columns.some(c => String(r[c] ?? "").toLowerCase().includes(q)));
  }, [rows, query, schema]);

  const allSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));
  const toggleRow = (id) => setSel(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleAll = () => setSel(prev => {
    const next = new Set(prev);
    if (allSelected) filtered.forEach(r => next.delete(r.id));
    else filtered.forEach(r => next.add(r.id));
    return next;
  });

  // Download the selected rows (or, if none selected, all filtered rows) as a
  // template-shaped CSV. Selection order follows the table (newest first).
  const download = () => {
    const picked = filtered.filter(r => selected.size === 0 || selected.has(r.id));
    if (picked.length === 0) return;
    const csv = sheetRowsToCSV(type, picked);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema.table}_export.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadLabel = selected.size > 0 ? `↓ Download ${selected.size} selected` : `↓ Download ${filtered.length} ${filtered.length===1?"row":"rows"}`;

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
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
        <div style={{...SS.label,marginBottom:0,flexShrink:0}}>
          {schema.label} sheet · {filtered.length}{filtered.length!==rows.length?`/${rows.length}`:""} {rows.length===1?"row":"rows"}
        </div>
        <div style={{flex:1}}/>
        <input
          value={query}
          onChange={e=>setQuery(e.target.value)}
          placeholder="Filter rows…"
          style={{...SS.input,width:200}}
        />
        <Btn sz="sm" v="primary" disabled={filtered.length===0} onClick={download}>{downloadLabel}</Btn>
      </div>
      {error ? (
        <div style={{color:T.danger,fontSize:12,fontFamily:T.mono,padding:"20px 0",textAlign:"center"}}>{error}</div>
      ) : rows.length===0 ? (
        <div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"30px 0"}}>{loading?"Loading…":`No ${schema.label.toLowerCase()} rows yet — upload a bill to populate this sheet`}</div>
      ) : filtered.length===0 ? (
        <div style={{color:T.dim,fontSize:12,textAlign:"center",padding:"30px 0"}}>No rows match “{query}”</div>
      ) : (
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12,whiteSpace:"nowrap"}}>
            <thead><tr style={{borderBottom:`1px solid ${T.line}`}}>
              <th style={{padding:"7px 10px",width:1}}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{cursor:"pointer",accentColor:T.accent}}/>
              </th>
              {schema.columns.map(h=><th key={h} style={{textAlign:"left",padding:"7px 10px",fontSize:10,color:T.dim,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>{h}</th>)}
            </tr></thead>
            <tbody>{filtered.map(r=>(
              <tr key={r.id} style={{borderBottom:`1px solid ${T.line}`,background:selected.has(r.id)?T.successBg:"transparent"}}>
                <td style={{padding:"9px 10px",width:1}}>
                  <input type="checkbox" checked={selected.has(r.id)} onChange={()=>toggleRow(r.id)} style={{cursor:"pointer",accentColor:T.accent}}/>
                </td>
                {schema.columns.map(c=><td key={c} style={{padding:"9px 10px",fontFamily:T.mono,fontSize:11,color:r[c]==null?T.dim:T.text}}>{fmt(r[c])}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  </>;
}
