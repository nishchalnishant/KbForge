import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "learnforge.fyi",
  description: "AI-narrated technical explainers — Machine Learning, LLMs, Frontend, Backend, AI Engineering.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
