// ─────────────────────────────────────────────────────────────────────────────
// FORMATTERS
// ─────────────────────────────────────────────────────────────────────────────
export const fmtD = s => s ? new Date(s).toLocaleDateString("en-IN",{day:"2-digit",month:"short",year:"numeric"}) : "—";
export const fmtN = n => n != null ? Number(n).toLocaleString("en-IN") : "—";
export const short = h => h ? h.slice(0,8)+"…"+h.slice(-6) : "—";
export const uid = () => "b"+Math.random().toString(36).slice(2,9);
