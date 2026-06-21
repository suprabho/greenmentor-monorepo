import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GreenMentor ESG-Agents",
  description: "AI-agent workforce for the 8-phase ESG/BRSR reporting engagement.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // TODO(M3): resolve per-org theme via lib/theme/resolveOrgTheme and inject CSS vars.
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
