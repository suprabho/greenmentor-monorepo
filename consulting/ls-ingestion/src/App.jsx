import { useState, useEffect } from "react";
import { SS } from "./theme.js";
import { EFDB_PUBLIC } from "./lib/efdb.js";
import Sidebar from "./components/Sidebar.jsx";
import TopBar from "./components/TopBar.jsx";
import Upload from "./pages/Upload.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Review from "./pages/Review.jsx";
import Records from "./pages/Records.jsx";
import Audit from "./pages/Audit.jsx";
import Settings from "./pages/Settings.jsx";

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [bills, setBills]               = useState([]);
  const [page, setPage]                 = useState("upload");
  const [selectedId, setSelectedId]     = useState(null);
  const [efdbToken, setEfdbToken]       = useState(null);
  const [efdbSrc, setEfdbSrc]           = useState("offline");
  const [globalExtracting, setGlobalExtracting] = useState(false);

  const reviewCount   = bills.filter(b=>b.status==="review").length;
  const selectedBill  = bills.find(b=>b.id===selectedId);

  // Probe EFDB public endpoint on mount
  useEffect(()=>{
    fetch(`${EFDB_PUBLIC}?page_size=1`,{signal:AbortSignal.timeout(5000)})
      .then(r=>{ if(r.ok) setEfdbSrc("efdb_public"); })
      .catch(()=>{});
  },[]);

  return (
    <div style={SS.app}>
      <link rel="preconnect" href="https://fonts.googleapis.com"/>
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=ABeeZee&display=swap" rel="stylesheet"/>
      <style>{`* { box-sizing: border-box; } @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>

      <Sidebar page={page} setPage={setPage} reviewCount={reviewCount} efdbSrc={efdbSrc} extracting={globalExtracting}/>

      <div style={SS.main}>
        <TopBar page={page} reviewCount={reviewCount} setPage={setPage}/>

        <div style={SS.content}>
          {page==="upload"   && <Upload efdbToken={efdbToken} setBills={setBills} setSelected={setSelectedId} setPage={setPage} setEfdbSrc={setEfdbSrc} setGlobalExtracting={setGlobalExtracting}/>}
          {page==="dash"     && <Dashboard bills={bills} setPage={setPage} setSelected={setSelectedId}/>}
          {page==="review"   && <Review bills={bills} setBills={setBills} selectedId={selectedId} setSelected={setSelectedId} setPage={setPage}/>}
          {page==="records"  && <Records bills={bills}/>}
          {page==="audit"    && <Audit bill={selectedBill}/>}
          {page==="settings" && <Settings efdbToken={efdbToken} setEfdbToken={setEfdbToken} efdbSrc={efdbSrc}/>}
        </div>
      </div>
    </div>
  );
}
