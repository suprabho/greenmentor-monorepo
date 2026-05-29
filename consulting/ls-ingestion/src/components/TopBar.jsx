import { T, SS, pill } from "../theme.js";
import { Dot } from "./ui.jsx";

const PAGE_TITLES = {upload:"Upload & Extract",ingest_ef:"Ingest Emission Factors",dash:"Dashboard",review:"Review",records:"Emission Records",sheets:"Sheets",audit:"Audit Trail",settings:"Settings"};

// ─────────────────────────────────────────────────────────────────────────────
// TOP BAR
// ─────────────────────────────────────────────────────────────────────────────
export default function TopBar({page,reviewCount,setPage}) {
  return (
    <div style={SS.topbar}>
      <div>
        <div style={{fontWeight:700,fontSize:16,fontFamily:T.head,letterSpacing:"-0.3px"}}>
          {PAGE_TITLES[page]}
        </div>
        <div style={{fontSize:11,color:T.dim,marginTop:1,fontFamily:T.mono}}>Maharashtra Govt Emissions Audit · FY 2024-25 · Real extraction active</div>
      </div>
      <div style={{display:"flex",gap:10,alignItems:"center"}}>
        {reviewCount>0&&(
          <div style={{...pill(T.warnBg,T.warn),cursor:"pointer",padding:"5px 12px",borderRadius:7}} onClick={()=>setPage("review")}>
            <Dot c={T.warn}/>{reviewCount} need review
          </div>
        )}
      </div>
    </div>
  );
}
