"use client";

import { useEffect } from "react";
import { literata, sourceSans3 } from "@/lib/fonts";
import { hu } from "@/lib/i18n/hu";
import "./globals.css";

/**
 * Last-resort root error boundary. Catches a synchronous throw that escaped the
 * root layout itself (where `app/(app)/error.tsx` cannot help, because the
 * layout has unmounted). Next.js REPLACES the root layout here, so this file
 * must render its own `<html>` + `<body>`.
 *
 * It is Alexandria-styled with the same design tokens (sourced from globals.css,
 * referenced via CSS variables so it stays correct even if Tailwind's class
 * layer didn't survive the failure) and offers a "Próbáld újra" button wired to
 * the `reset` prop. We never white-screen and never swallow: the error is logged
 * for dev visibility while the recoverable fallback takes over.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <html
      lang="hu"
      data-woa="light"
      className={`${sourceSans3.variable} ${literata.variable}`}
    >
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          background: "var(--bg, #f6f1e6)",
          color: "var(--text, #2d2618)",
          fontFamily: "var(--font-sans), ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <main
          role="alert"
          aria-label={hu.errors.regionAria}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "14px",
            maxWidth: "420px",
            textAlign: "center",
            padding: "32px",
            borderRadius: "16px",
            border: "1px solid var(--border, #ded2b8)",
            background: "var(--surface, #fffdf7)",
            boxShadow: "0 1px 2px rgba(0,0,0,.04), 0 8px 24px rgba(0,0,0,.06)",
          }}
        >
          <span
            aria-hidden
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "48px",
              height: "48px",
              borderRadius: "16px",
              background: "var(--danger-muted, #fcefe6)",
              color: "var(--danger-text, #9a3412)",
            }}
          >
            {/* Inline AlertTriangle (no icon dep, in case modules failed). */}
            <svg
              width={24}
              height={24}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </span>
          <h1
            style={{
              margin: 0,
              fontSize: "17px",
              fontWeight: 600,
              color: "var(--text, #2d2618)",
            }}
          >
            {hu.errors.rootTitle}
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              lineHeight: 1.5,
              color: "var(--text-muted, #6e6450)",
            }}
          >
            {hu.errors.rootHint}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "4px",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "38px",
              padding: "0 16px",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "13px",
              fontWeight: 600,
              fontFamily: "inherit",
              background: "var(--accent-strong, #8a5f14)",
              color: "var(--accent-fg, #fffdf7)",
            }}
          >
            {hu.errors.rootRetry}
          </button>
        </main>
      </body>
    </html>
  );
}
