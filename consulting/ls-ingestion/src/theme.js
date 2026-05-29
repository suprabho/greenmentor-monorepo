// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
// Greenmentor brand — dark world (teal-900 surface + neon green accent).
// Mirrors the design tokens in academy/green-mentor-plus/app/globals.css.
export const T = {
  bg:"#014A50",        // teal-900 — deep brand background
  surface:"#0E3F44",   // shaded teal-900 — sidebar/topbar surface
  card:"#164E4F",      // teal-800 — card surface
  border:"#21776A",    // teal-600 — card strokes
  line:"#1E5A5C",      // softer divider on dark teal
  accent:"#07D862",    // green-500 — neon accent
  accentDim:"#009C62", // green-700 — primary green
  accentGlow:"rgba(7,216,98,0.12)",
  text:"#ECFCEA",      // green-50 — body on dark
  muted:"#A8C7BC",     // pale teal-tinted muted text
  dim:"#5F8580",       // dim teal-grey
  danger:"#F87171",    dangerBg:"rgba(248,113,113,0.08)", dangerLine:"rgba(248,113,113,0.25)",
  warn:"#FFB020",      warnBg:"rgba(255,176,32,0.10)",    warnLine:"rgba(255,176,32,0.28)",
  info:"#60A5FA",      infoBg:"rgba(96,165,250,0.08)",    infoLine:"rgba(96,165,250,0.25)",
  successBg:"rgba(7,216,98,0.10)", successLine:"rgba(7,216,98,0.25)",
  mono:"ui-monospace, 'SF Mono', Menlo, monospace",
  head:"'Inter', system-ui, -apple-system, sans-serif",
  body:"'Inter', system-ui, -apple-system, sans-serif",
  accentFont:"'ABeeZee', 'Inter', system-ui, sans-serif",
};

export const pill = (bg,c,extra={}) => ({ display:"inline-flex",alignItems:"center",gap:5,padding:"3px 10px",borderRadius:20,background:bg,color:c,fontSize:11,fontWeight:600,whiteSpace:"nowrap",...extra });
export const tag  = (bg,c) => ({ padding:"2px 8px",borderRadius:5,fontSize:11,fontWeight:600,background:bg,color:c,fontFamily:T.mono });

export const SS = {
  app:     { display:"flex",height:"100vh",fontFamily:T.body,background:T.bg,color:T.text,overflow:"hidden",fontSize:14 },
  side:    { width:224,background:T.surface,display:"flex",flexDirection:"column",borderRight:`1px solid ${T.line}`,flexShrink:0 },
  main:    { flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0 },
  topbar:  { background:T.surface,borderBottom:`1px solid ${T.line}`,padding:"13px 28px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0 },
  content: { flex:1,overflow:"auto",padding:"22px 28px" },
  card:    { background:T.card,border:`1px solid ${T.border}`,borderRadius:10,padding:"18px 22px",marginBottom:14 },
  label:   { fontSize:10,fontWeight:700,color:T.dim,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12,fontFamily:T.head },
  input:   { width:"100%",padding:"7px 10px",background:T.bg,border:`1px solid ${T.line}`,borderRadius:6,fontSize:12,fontFamily:T.mono,color:T.text,outline:"none",boxSizing:"border-box" },
  mono:    { fontFamily:T.mono,fontSize:11,background:"#070B07",color:"#4ADE80",padding:14,borderRadius:8,lineHeight:1.75,whiteSpace:"pre-wrap",wordBreak:"break-all",overflowX:"auto",margin:0 },
};
