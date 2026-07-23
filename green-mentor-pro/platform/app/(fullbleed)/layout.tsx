// Full-bleed route group: immersive experiences (lesson video, live webinars)
// that escape the app Shell — no sidebar, no padded <main>, just the page and
// its own back-button overlay. URLs are unchanged; only the chrome differs.
export default function FullBleedLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen">{children}</div>;
}
