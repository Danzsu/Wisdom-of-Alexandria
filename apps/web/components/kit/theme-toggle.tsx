"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { hu } from "@/lib/i18n/hu";

/**
 * Theme switch button. Shows a sun in light mode and a moon in dark mode, and
 * flips between the two themes. next-themes persists the choice to localStorage.
 *
 * Rendering is deferred until mounted to avoid a hydration mismatch (the server
 * cannot know the persisted theme).
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      aria-label={hu.kit.themeToggle}
      title={hu.kit.themeToggle}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      style={{
        width: 36,
        height: 36,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        borderRadius: 8,
        color: "var(--text-muted)",
        cursor: "pointer",
      }}
    >
      {/* Render a neutral placeholder pre-mount so SSR markup is stable. */}
      {mounted ? (
        isDark ? (
          <Moon size={16} aria-hidden="true" />
        ) : (
          <Sun size={16} aria-hidden="true" />
        )
      ) : (
        <span style={{ width: 16, height: 16 }} aria-hidden="true" />
      )}
    </button>
  );
}
