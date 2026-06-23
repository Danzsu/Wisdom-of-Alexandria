import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { literata, inter, cormorantGaramond, caveat } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alexandria",
  description:
    "Alexandria — local-first, Hungarian-first AI novel-writing workspace.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="hu"
      data-woa="light"
      suppressHydrationWarning
      className={`${inter.variable} ${literata.variable} ${cormorantGaramond.variable} ${caveat.variable}`}
    >
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          background: "var(--bg)",
          color: "var(--text)",
          fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
