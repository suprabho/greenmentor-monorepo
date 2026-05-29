import { useState } from "react";
import { T, SS, pill } from "../theme.js";
import { Btn } from "../components/ui.jsx";
import { EFDB_PUBLIC, EFDB_AUTH, EFDB_LOGIN, EFDB_QUERIES, factorCache } from "../lib/efdb.js";

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────
export default function Settings({efdbToken, setEfdbToken, efdbSrc}) {
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
