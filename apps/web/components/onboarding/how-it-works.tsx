"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Library,
  LayoutList,
  Sparkles,
  CheckCheck,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { useUIStore } from "@/lib/stores/ui-store";
import { hu } from "@/lib/i18n/hu";

/**
 * localStorage key for the first-run "Hogyan működik" tour. Mirrors the
 * dashboard onboarding-banner key style (`woa-…-dismissed`). Set to "1" once the
 * user skips/closes/finishes, so the tour never auto-opens again.
 */
export const HOW_IT_WORKS_KEY = "woa-how-it-works-dismissed";

/** One Lucide glyph per step (a tasteful diagram cue, not stock art). */
const STEP_ICONS: LucideIcon[] = [Library, LayoutList, Sparkles, CheckCheck];

/**
 * True when the user prefers reduced motion. Read at call time (not cached) so
 * the motion gate is fresh on each render. SSR / jsdom-safe: returns `false`
 * when `matchMedia` is unavailable.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The first-run "Hogyan működik" tour — a SKIPPABLE, modal step carousel
 * (Radix Dialog: focus-trapped, Esc-to-close, titled + described) that teaches
 * the product's core loop in four calm steps: Codex → Tervezés → AI-javaslat →
 * Jóváhagyás. One step is visible at a time, centered, on a dotted-grid hero
 * band with a large per-step icon.
 *
 * Navigation: a gold-gradient Next (becomes "Kezdjük" / finish on the last
 * step), a Back that appears after the first step, a clickable dot-nav, and a
 * "N / M" step counter. An always-visible inline skip and the corner X both
 * dismiss permanently.
 *
 * Motion: the step content fades/lifts in on each change via the shared
 * `woaReveal` keyframe (keyed on the step index). Under `prefers-reduced-motion`
 * the animation is dropped — the step simply swaps, which IS the a11y baseline.
 *
 * Open state lives in the shared UI store (`howItWorksOpen`). Skip / close /
 * finish all write the `localStorage` flag so the tour never auto-opens again;
 * it stays reachable from the TopBar help button and the command palette
 * ("Hogyan működik"). The user can dismiss it immediately — it never traps them.
 */
export function HowItWorks() {
  const open = useUIStore((s) => s.howItWorksOpen);
  const close = useUIStore((s) => s.closeHowItWorks);
  const [step, setStep] = useState(0);

  const panels = hu.howItWorks.panels;
  const total = panels.length;

  // Always (re)start the tour on its first step whenever it opens, so a prior
  // session's position never leaks into a fresh open.
  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  /** Persist the dismissal (best-effort) and close the overlay. */
  function dismiss() {
    try {
      window.localStorage.setItem(HOW_IT_WORKS_KEY, "1");
    } catch {
      // Persisting is best-effort; the in-session close still applies.
    }
    close();
  }

  /** Next on a middle step advances; on the last step it finishes the tour. */
  function handleNext() {
    if (step >= total - 1) {
      dismiss();
      return;
    }
    setStep((s) => Math.min(s + 1, total - 1));
  }

  function handleBack() {
    setStep((s) => Math.max(s - 1, 0));
  }

  const reduced = prefersReducedMotion();
  const panel = panels[step];
  const glyph = STEP_ICONS[step] ?? Library;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && dismiss()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[55] bg-[rgba(24,18,9,.45)] backdrop-blur-[8px] [animation:woaFade_.16s_ease-out]" />
        <Dialog.Content
          aria-label={hu.howItWorks.title}
          className="fixed left-1/2 top-1/2 z-[56] flex max-h-[calc(100dvh-48px)] w-[560px] max-w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[20px] border border-border bg-surface shadow-modal [animation:woaReveal_.26s_cubic-bezier(.22,1,.36,1)]"
        >
          {/* Corner skip — works without touching the carousel. */}
          <button
            type="button"
            onClick={dismiss}
            aria-label={hu.howItWorks.closeAria}
            className="absolute right-3.5 top-3.5 z-[3] flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-surface/60 text-text-muted transition-colors hover:bg-surface hover:text-text"
          >
            <Icon icon={X} size={15} />
          </button>

          {/* Hero band: dotted-grid backdrop + large per-step icon. */}
          <div className="relative flex h-[136px] items-center justify-center bg-gold-soft/45">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-40 [background-image:radial-gradient(var(--gold-line)_1px,transparent_1px)] [background-size:22px_22px]"
            />
            <span
              key={`icon-${step}`}
              aria-hidden="true"
              className="relative flex h-[60px] w-[60px] items-center justify-center rounded-2xl border border-gold-line bg-surface text-gold-text shadow-card"
              style={
                reduced
                  ? undefined
                  : { animation: "woaReveal .3s cubic-bezier(.22,1,.36,1)" }
              }
            >
              <Icon icon={glyph} size={28} strokeWidth={1.6} />
            </span>
          </div>

          {/* Step body: eyebrow + display title + body. */}
          <div
            key={`body-${step}`}
            className="px-[30px] pb-2 pt-[26px] text-center"
            style={
              reduced
                ? undefined
                : { animation: "woaReveal .3s cubic-bezier(.22,1,.36,1)" }
            }
          >
            <p className="m-0 mb-[9px] text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-text">
              {panel.kicker}
            </p>
            <Dialog.Title className="m-0 mb-2.5 font-display text-[30px] font-semibold leading-[1.08] text-text">
              {panel.title}
            </Dialog.Title>
            <p className="m-0 mx-auto max-w-[400px] font-serif text-[15px] leading-[1.7] text-text-muted [text-wrap:pretty]">
              {panel.body}
            </p>
          </div>
          <Dialog.Description className="sr-only">
            {hu.howItWorks.description}
          </Dialog.Description>

          {/* Dot-nav: jump to any step. */}
          <div className="flex items-center justify-center gap-2 pb-[18px] pt-[22px]">
            {panels.map((p, i) => {
              const active = i === step;
              return (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => setStep(i)}
                  aria-label={hu.howItWorks.dotAria(i + 1)}
                  aria-current={active ? "step" : undefined}
                  className={
                    active
                      ? "h-2 w-5 rounded-full bg-gold transition-all"
                      : "h-2 w-2 rounded-full bg-border-strong transition-all hover:bg-gold-text"
                  }
                />
              );
            })}
          </div>

          {/* Footer: Back (after step 1) · inline skip · counter · gold Next. */}
          <div className="flex items-center gap-2.5 px-6 pb-[22px]">
            {!isFirst && (
              <button
                type="button"
                onClick={handleBack}
                className="inline-flex h-[42px] items-center gap-1.5 rounded-[11px] border border-border bg-surface px-4 text-[13.5px] font-semibold text-text transition-colors hover:border-border-strong"
              >
                <Icon icon={ChevronLeft} size={15} />
                {hu.howItWorks.back}
              </button>
            )}
            <button
              type="button"
              onClick={dismiss}
              aria-label={hu.howItWorks.skipAria}
              className="h-[42px] rounded-[11px] px-3.5 text-[13px] font-semibold text-text-muted transition-colors hover:text-text"
            >
              {hu.howItWorks.skipInline}
            </button>
            <div className="flex-1" />
            <span className="text-[12px] tabular-nums text-text-faint">
              {hu.howItWorks.stepCounter(step + 1, total)}
            </span>
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-[42px] items-center gap-[7px] rounded-[11px] bg-[linear-gradient(145deg,var(--gold)_0%,var(--gold-deep)_100%)] px-[22px] text-[13.5px] font-semibold text-white shadow-[0_4px_14px_color-mix(in_srgb,var(--gold)_38%,transparent)]"
            >
              {isLast ? hu.howItWorks.finish : hu.howItWorks.next}
              {!isLast && <Icon icon={ChevronRight} size={15} />}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

/**
 * Retained for backwards compatibility — previously auto-opened the "Hogyan
 * működik" tour on first run, which caused two onboarding patterns to stack on
 * the dashboard (modal on top of the inline "Három lépés" banner). The
 * auto-open has been removed: the tour is now an on-demand affordance only
 * (the "Hogyan működik?" button in the TopBar). This component renders nothing
 * and can be safely removed in a future cleanup pass once all call-sites are
 * updated.
 */
export function HowItWorksFirstRun() {
  return null;
}
