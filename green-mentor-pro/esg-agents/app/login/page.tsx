"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const ACCENT = "#1f8a5b";
const BORDER = "#e3e8e5";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [need2fa, setNeed2fa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, otp: need2fa ? otp : undefined }),
      });
      const data = await res.json();
      if (data?.require2FA) {
        setNeed2fa(true);
        setError(null);
        return;
      }
      if (!res.ok) throw new Error(data?.error ?? `Login failed (${res.status})`);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f6f8f7", color: "#1a2420", display: "grid", placeItems: "center", fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto" }}>
      <form onSubmit={submit} style={{ width: 360, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: ACCENT, color: "#fff", display: "grid", placeItems: "center", fontSize: 18 }}>🌱</div>
          <div>
            <div style={{ fontWeight: 750, fontSize: 17 }}>GreenMentor ESG</div>
            <div style={{ fontSize: 12, color: "#5d6b64" }}>Sign in with your GreenMentor account</div>
          </div>
        </div>

        <label style={lbl}>Username or email</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" style={inp} disabled={need2fa} />

        <label style={lbl}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" style={inp} disabled={need2fa} />

        {need2fa && (
          <>
            <label style={lbl}>Authentication code</label>
            <input value={otp} onChange={(e) => setOtp(e.target.value)} inputMode="numeric" autoFocus placeholder="6-digit code" style={inp} />
          </>
        )}

        {error && (
          <div style={{ fontSize: 13, fontWeight: 600, color: "#c2410c", background: "#fde8de", padding: "9px 11px", borderRadius: 8, margin: "4px 0 12px" }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={busy} style={{ width: "100%", background: ACCENT, color: "#fff", border: "none", borderRadius: 10, padding: "11px 16px", fontSize: 14.5, fontWeight: 700, cursor: busy ? "wait" : "pointer", opacity: busy ? 0.6 : 1, marginTop: 6 }}>
          {busy ? "Signing in…" : need2fa ? "Verify code" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const lbl: React.CSSProperties = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#5d6b64", margin: "10px 0 5px" };
const inp: React.CSSProperties = { width: "100%", boxSizing: "border-box", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "10px 12px", fontSize: 14, outline: "none", background: "#fff", color: "#1a2420" };
