import type { Metadata } from "next";
import { Inter, Manrope, ABeeZee } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const manrope = Manrope({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600", "700"],
});

const abeezee = ABeeZee({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-accent",
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Green Mentor Pro",
  description:
    "Unified consumer/prosumer ESG platform — Feed, Academy, AI Hub. Convergence vertical slice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${manrope.variable} ${abeezee.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
