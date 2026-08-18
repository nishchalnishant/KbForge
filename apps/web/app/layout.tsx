import type { ReactNode } from "react";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { Analytics } from "@vercel/analytics/next";
import { getTopicSummaries } from "@/lib/content";
import { SITE_URL } from "@/lib/site";
import { SearchPalette } from "@/components/SearchPalette";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

const title = "learnforge.fyi";
const description =
  "AI-narrated technical explainers — Machine Learning, LLMs, Frontend, Backend, AI Engineering.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: title,
    template: `%s — ${title}`,
  },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: SITE_URL,
    siteName: title,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const topics = getTopicSummaries();

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <div className="bg-mesh" aria-hidden="true">
          <span className="bg-orb bg-orb-1" />
          <span className="bg-orb bg-orb-2" />
          <span className="bg-orb bg-orb-3" />
          <span className="bg-grid" />
          <span className="bg-noise" />
        </div>
        <div className="site-shell">
          <header className="site-header">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true" />
              learnforge<span className="brand-dim">.fyi</span>
            </Link>
            <nav className="site-nav">
              <SearchPalette />
              <a href="https://github.com/nishchalnishant/KbForge" target="_blank" rel="noreferrer">
                <span>GitHub</span>
              </a>
            </nav>
          </header>
          {children}
          <footer className="site-footer">
            <nav className="site-footer-nav" aria-label="Topics">
              {topics.map((t) => (
                <Link key={t.id} href={`/node/${t.id}`}>
                  {t.title}
                </Link>
              ))}
            </nav>
            <span>learnforge.fyi — text-first explainers, narrated video landing on every node soon.</span>
          </footer>
        </div>
        <Analytics />
      </body>
    </html>
  );
}
