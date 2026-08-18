import type { ReactNode } from "react";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "learnforge.fyi",
  description: "AI-narrated technical explainers — Machine Learning, LLMs, Frontend, Backend, AI Engineering.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="site-shell">
          <header className="site-header">
            <Link href="/" className="brand">
              <span className="brand-mark" aria-hidden="true" />
              learnforge<span className="brand-dim">.fyi</span>
            </Link>
            <nav className="site-nav">
              <a href="https://github.com/nishchalnishant/KbForge" target="_blank" rel="noreferrer">
                GitHub
              </a>
            </nav>
          </header>
          {children}
          <footer className="site-footer">
            <span>learnforge.fyi — text-first explainers, video coming soon.</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
