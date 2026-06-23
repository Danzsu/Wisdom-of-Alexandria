"use client";

import { useLayoutEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Library, LayoutList, Sparkles, CheckCheck, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { useUIStore } from "@/lib/stores/ui-store";
import { canAnimateGsap } from "@/lib/gsap-gate";
import { hu } from "@/lib/i18n/hu";

/**
 * localStorage key for the first-run "Hogyan működik" narrative. Mirrors the
 * dashboard onboarding-banner key style (`woa-…-dismissed`). Set to "1" once the
 * user skips/closes, so the narrative never auto-opens again.
 */
export const HOW_IT_WORKS_KEY = "woa-how-it-works-dismissed";

/** One Lucide glyph per panel (a tasteful diagram cue, not stock art). */
const PANEL_ICONS: LucideIcon[] = [Library, LayoutList, Sparkles, CheckCheck];

/**
 * True when the user prefers reduced motion. Read at call time (not cached) so
 * the GSAP path is gated freshly on each open. SSR / jsdom-safe: returns `false`
 * when `matchMedia` is unavailable, which keeps the static fallback as the
 * default (see {@link useScrollNarrative}, which never registers GSAP in tests).
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Whether the scroll-driven GSAP enhancement may run at all. It is suppressed
 * under reduced motion AND under test (jsdom has no layout/scroll, so
 * ScrollTrigger would be a meaningless no-op — we skip registration entirely so
 * the static markup is what tests assert). Anything but a real, motion-allowing
 * browser falls back to the plain scrollable stack.
 */
function canRunScrollNarrative(): boolean {
  const hasWindow = typeof window !== "undefined";
  return canAnimateGsap(
    hasWindow,
    // Vitest sets this; never register GSAP under test.
    process.env.NODE_ENV === "test",
    hasWindow && typeof window.matchMedia === "function"
      ? window.matchMedia.bind(window)
      : undefined,
  );
}

/**
 * Registers GSAP ScrollTrigger to pin + fade each panel in sequence, scoped to
 * `containerRef` via `gsap.context` so teardown is a single `ctx.revert()` —
 * killing every ScrollTrigger and tween this component created, with no leak
 * across route changes or re-opens. Does NOTHING under reduced motion / test
 * (the static stack already renders the panels). GSAP is imported dynamically
 * so it never lands in the SSR bundle and never runs server-side.
 */
function useScrollNarrative(
  containerRef: React.RefObject<HTMLDivElement | null>,
  open: boolean,
) {
  useLayoutEffect(() => {
    if (!open) return;
    if (!canRunScrollNarrative()) return;
    const root = containerRef.current;
    if (!root) return;

    let ctx: { revert: () => void } | null = null;
    let cancelled = false;

    // Dynamic import keeps GSAP client-only and out of the SSR/test path.
    void (async () => {
      try {
        const gsapMod = await import("gsap");
        const stMod = await import("gsap/ScrollTrigger");
        if (cancelled) return;
        const gsap = gsapMod.gsap ?? gsapMod.default;
        const ScrollTrigger = stMod.ScrollTrigger ?? stMod.default;
        gsap.registerPlugin(ScrollTrigger);

        ctx = gsap.context((self) => {
          const select = self.selector as
            | ((q: string) => Element[])
            | undefined;
          const panels = select
            ? (select("[data-hiw-panel]") as HTMLElement[])
            : [];
          panels.forEach((panel) => {
            // Calm, restrained: opacity + small upward translate only, ease-out,
            // no bounce. Scrubbed to the panel's own scroll position.
            gsap.fromTo(
              panel,
              { opacity: 0.15, y: 24 },
              {
                opacity: 1,
                y: 0,
                ease: "power2.out",
                scrollTrigger: {
                  trigger: panel,
                  scroller: root,
                  start: "top 80%",
                  end: "top 40%",
                  scrub: true,
                },
              },
            );
          });
        }, root);
      } catch {
        // GSAP failed to load (offline chunk, etc.): the static stack already
        // rendered the panels, so the narrative remains fully readable. We log
        // rather than swallow silently so the degradation is observable.
        if (!cancelled) {
          console.warn(
            "[how-it-works] GSAP scroll narrative unavailable; static fallback in use.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      if (ctx) ctx.revert();
    };
  }, [containerRef, open]);
}

/**
 * The first-run "Hogyan működik" scroll-narrative. A SKIPPABLE, modal overlay
 * (Radix Dialog: focus-trapped, Esc-to-close, titled + described) that teaches
 * the product's core loop in four calm panels: Codex → Tervezés → AI-javaslat →
 * Jóváhagyás.
 *
 * Motion: GSAP ScrollTrigger pins/fades each panel as the user scrolls — the
 * justified GSAP beachhead (Framer Motion doesn't do scroll-pinning cleanly).
 * It is registered client-side, scoped to the scroll container via `gsap.context`,
 * and fully reverted on close/unmount (no ScrollTrigger leak). Under
 * `prefers-reduced-motion` (and under test) GSAP never registers — the four
 * panels render as a plain, static, scrollable stack, which IS the a11y baseline.
 *
 * Open state lives in the shared UI store (`howItWorksOpen`). Skip / close both
 * write the `localStorage` flag so the narrative never auto-opens again; it stays
 * reachable from the command palette ("Hogyan működik"). The user can dismiss it
 * immediately without scrolling — it never traps them.
 */
export function HowItWorks() {
  const open = useUIStore((s) => s.howItWorksOpen);
  const close = useUIStore((s) => s.closeHowItWorks);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useScrollNarrative(scrollRef, open);

  /** Persist the dismissal (best-effort) and close the overlay. */
  function dismiss() {
    try {
      window.localStorage.setItem(HOW_IT_WORKS_KEY, "1");
    } catch {
      // Persisting is best-effort; the in-session close still applies.
    }
    close();
  }

  const reduced = prefersReducedMotion();

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && dismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-[rgba(24,18,9,.45)] [animation:woaFade_.16s_ease-out]" />
        <Dialog.Content
          aria-label={hu.howItWorks.title}
          className="fixed left-1/2 top-1/2 z-[56] flex max-h-[min(640px,calc(100dvh-48px))] w-[560px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] border border-border bg-bg shadow-popover [animation:woaReveal_.18s_cubic-bezier(.22,1,.36,1)]"
        >
          {/* Header: eyebrow + title + a close that works without scrolling. */}
          <div className="flex items-start gap-3 border-b border-border bg-surface px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-accent-text">
                {hu.howItWorks.eyebrow}
              </p>
              <Dialog.Title className="m-0 font-serif text-[19px] font-semibold text-text">
                {hu.howItWorks.title}
              </Dialog.Title>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={hu.howItWorks.closeAria}
              className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-muted hover:text-text"
            >
              <Icon icon={X} size={15} />
            </button>
          </div>
          <Dialog.Description className="sr-only">
            {hu.howItWorks.description}
          </Dialog.Description>

          {/* Scroll container — the ScrollTrigger scroller. Under reduced motion
              / test it's just a readable, scrollable stack. */}
          <div
            ref={scrollRef}
            data-testid="how-it-works-scroll"
            className="min-h-0 flex-1 overflow-y-auto px-5 py-5"
          >
            <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
              {hu.howItWorks.panels.map((panel, i) => {
                const glyph = PANEL_ICONS[i] ?? Library;
                return (
                  <li
                    key={panel.title}
                    data-hiw-panel=""
                    className="flex gap-3.5 rounded-2xl border border-border bg-surface p-[18px] shadow-card"
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-accent-muted text-accent-text"
                    >
                      <Icon icon={glyph} size={18} />
                    </span>
                    <div className="min-w-0">
                      <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.07em] text-text-faint">
                        {panel.kicker}
                      </p>
                      <p className="m-0 mt-0.5 font-serif text-[17px] font-semibold text-text">
                        {panel.title}
                      </p>
                      <p className="m-0 mt-1.5 text-[13px] leading-[1.55] text-text-muted">
                        {panel.body}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* Footer: always-visible skip that works without scrolling. */}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-surface px-5 py-3.5">
            <span className="text-[11px] text-text-faint">
              {reduced ? "" : hu.howItWorks.scrollHint}
            </span>
            <button
              type="button"
              onClick={dismiss}
              aria-label={hu.howItWorks.skipAria}
              className="flex h-9 items-center rounded-lg border border-accent bg-accent-muted px-4 text-[13px] font-semibold text-accent-text transition-colors hover:bg-accent-strong hover:text-accent-fg"
            >
              {hu.howItWorks.skip}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Retained for backwards compatibility — previously auto-opened the "Hogyan
 * működik" narrative on first run, which caused two onboarding patterns to stack
 * on the dashboard (modal on top of the inline "Három lépés" banner). The
 * auto-open has been removed: the narrative is now an on-demand affordance only
 * (the "Hogyan működik?" button in the TopBar). This component renders nothing
 * and can be safely removed in a future cleanup pass once all call-sites are
 * updated.
 */
export function HowItWorksFirstRun() {
  return null;
}
