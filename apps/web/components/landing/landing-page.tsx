"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  Database,
  Moon,
  Play,
  Sparkles,
  Star,
  Sun,
} from "lucide-react";
import { hu } from "@/lib/i18n/hu";
import { routes } from "@/lib/routes";
import { EmbersCanvas } from "./embers-canvas";
import {
  useHeroTilt,
  useMagnetic,
  useParallaxGlow,
} from "./use-landing-motion";

const t = hu.landing;

/** Icons for the four feature pillars, indexed alongside `hu.landing.pillars`. */
const PILLAR_ICONS = [Database, BookOpen, Sparkles, Brain] as const;

/**
 * IntersectionObserver-driven reveal: every element carrying `data-reveal`
 * starts translated-down + transparent and settles into place when it scrolls
 * into view. Under `prefers-reduced-motion` everything is shown immediately and
 * never animated. The global reduced-motion CSS rule also neutralises the
 * transition, so this is belt-and-braces.
 */
function useReveal() {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const nodes = Array.from(
      root.querySelectorAll<HTMLElement>("[data-reveal]"),
    );

    // "Arm" the reveal: only now does the hidden start-state apply (the
    // `[data-reveal-armed]` ancestor selector gates it). If JS never runs the
    // content stays fully visible — the animation is a pure enhancement.
    root.dataset.revealArmed = "1";

    const revealAll = () => {
      for (const n of nodes) n.dataset.revealIn = "1";
    };

    const reduced = globalThis.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      revealAll();
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.revealIn = "1";
            io.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -8% 0px" },
    );
    for (const n of nodes) io.observe(n);
    // Safety net: if anything is still hidden after a moment (observer never
    // fired, e.g. print/no-layout), reveal everything so content is never lost.
    const failsafe = globalThis.setTimeout(revealAll, 1200);
    return () => {
      io.disconnect();
      globalThis.clearTimeout(failsafe);
    };
  }, []);

  return rootRef;
}

/**
 * Reveal target classes. Base state is VISIBLE; the hidden start-state
 * (`opacity-0` + 22px translate) applies only inside an armed root and only
 * until the node gains `data-reveal-in`. So with no JS, content shows normally;
 * with JS, it fades up as it scrolls into view. The global reduced-motion CSS
 * rule neutralises the transition. Timing follows the design's tuned `.reveal`
 * (22px / .82s / --ease-soft).
 */
const revealClass =
  "transition-[transform,opacity] duration-[820ms] ease-[var(--ease-soft)] [[data-reveal-armed]_&:not([data-reveal-in])]:translate-y-[22px] [[data-reveal-armed]_&:not([data-reveal-in])]:opacity-0";

function ThemeButton() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const isDark = resolvedTheme === "dark";

  // Render a neutral placeholder pre-mount so SSR markup is stable (the server
  // cannot know the persisted theme); swap to the live icon once mounted.
  let icon = <span className="h-4 w-4" aria-hidden="true" />;
  if (mounted) {
    icon = isDark ? (
      <Moon size={16} aria-hidden="true" />
    ) : (
      <Sun size={16} aria-hidden="true" />
    );
  }

  return (
    <button
      type="button"
      aria-label={t.themeToggleAria}
      title={t.themeToggleAria}
      onClick={() => {
        // Pre-mount, `resolvedTheme` is undefined → `isDark` is a stale guess.
        // Ignore clicks during the hydration window so we never force the
        // wrong theme.
        if (!mounted) return;
        setTheme(isDark ? "light" : "dark");
      }}
      className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] border border-border bg-surface text-text-muted transition-colors hover:border-border-strong hover:text-text"
    >
      {icon}
    </button>
  );
}

/** Gold-gradient star tile used by the nav + footer brand lockups. */
function StarTile({ size = 34 }: Readonly<{ size?: number }>) {
  return (
    <span
      aria-hidden="true"
      className="flex flex-none items-center justify-center rounded-[9px] bg-[linear-gradient(145deg,var(--gold),var(--gold-deep))] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.18)]"
      style={{ width: size, height: size }}
    >
      <Star size={size * 0.52} strokeWidth={1.6} fill="none" />
    </span>
  );
}

export function LandingPage() {
  const rootRef = useReveal();
  // Micro-interaction pass (design canvas): magnetic CTAs, hero tilt,
  // parallax glow. All of them are hard no-ops under prefers-reduced-motion.
  const navCtaRef = useMagnetic<HTMLAnchorElement>();
  const heroCtaRef = useMagnetic<HTMLAnchorElement>();
  const footerCtaRef = useMagnetic<HTMLAnchorElement>();
  const { zoneRef: heroZoneRef, tiltRef: heroTiltRef } = useHeroTilt<
    HTMLElement,
    HTMLDivElement
  >();
  const glowRef = useParallaxGlow<HTMLDivElement>();

  const scrollToShowcase = useCallback(() => {
    document
      .getElementById("muhely")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  return (
    <div
      ref={rootRef}
      className="woa-scroll min-h-dvh bg-bg font-sans text-[14px] leading-normal text-text"
    >
      {/* Landing-only keyframes; the global reduced-motion rule neutralises them. */}
      <style>{`
        @keyframes woaLandFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
        @keyframes woaLandCaret{0%,49%{opacity:1}50%,100%{opacity:0}}
        @keyframes woaLandBar{0%{transform:translateX(-130%)}100%{transform:translateX(360%)}}
      `}</style>
      {/* Stagger reveal (design `.stagger`): the PARENT carries the reveal
          trigger; children rise 16px with 80ms incremental delays. Same
          fail-safe as revealClass — hidden only inside an armed root until
          the parent gains data-reveal-in, so content is never lost. */}
      <style>{`
        .woa-land-stagger>*{transition:transform .6s var(--ease-soft),opacity .6s var(--ease-soft)}
        .woa-land-stagger>*:nth-child(2){transition-delay:80ms}
        .woa-land-stagger>*:nth-child(3){transition-delay:160ms}
        .woa-land-stagger>*:nth-child(4){transition-delay:240ms}
        [data-reveal-armed] .woa-land-stagger:not([data-reveal-in])>*{transform:translateY(16px);opacity:0}
        @media (prefers-reduced-motion:reduce){.woa-land-stagger>*{transition:none;transition-delay:0ms}}
      `}</style>

      {/* ── sticky top nav ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex h-[68px] items-center gap-[18px] border-b border-border bg-[color-mix(in_srgb,var(--bg)_86%,transparent)] px-7 backdrop-blur-[10px]">
        <Link
          href={routes.projects()}
          aria-label={t.brandAria}
          className="flex items-center gap-[11px] no-underline"
        >
          <StarTile size={34} />
          <span className="pt-[3px] font-hand text-[31px] font-bold leading-none tracking-[.005em] text-gold-text">
            {t.wordmark}
          </span>
        </Link>
        <nav
          aria-label={t.navAria}
          className="ml-[18px] flex gap-1 max-md:hidden"
        >
          <a
            href="#funkciok"
            className="rounded-lg px-3 py-2 text-[13.5px] text-text-muted no-underline transition-colors hover:bg-surface-muted hover:text-text"
          >
            {t.navFeatures}
          </a>
          <a
            href="#muhely"
            className="rounded-lg px-3 py-2 text-[13.5px] text-text-muted no-underline transition-colors hover:bg-surface-muted hover:text-text"
          >
            {t.navWorkshop}
          </a>
          <a
            href="#elv"
            className="rounded-lg px-3 py-2 text-[13.5px] text-text-muted no-underline transition-colors hover:bg-surface-muted hover:text-text"
          >
            {t.navPhilosophy}
          </a>
        </nav>
        <div className="flex-1" />
        <ThemeButton />
        {/* Magnetic CTA — the JS lerp replaces the CSS hover-lift (a CSS
            transition on transform would fight the per-frame writes). */}
        <Link
          ref={navCtaRef}
          href={routes.projects()}
          className="flex h-[38px] items-center gap-2 rounded-[10px] bg-text px-[18px] text-[13.5px] font-semibold text-bg no-underline active:scale-[.97]"
        >
          {t.enterApp}
          <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
        </Link>
      </header>

      <main>
        {/* ── hero ───────────────────────────────────────────────────── */}
        {/* The section is the tilt "zone": pointer movement anywhere over the
            hero drives the editor mock's 3D tilt. */}
        <section ref={heroZoneRef} className="relative overflow-hidden px-7">
          {/* drifting gold embers behind the hero (reduced-motion aware) */}
          <EmbersCanvas className="z-0" />
          {/* radial glow — drifts at a fraction of scroll speed (parallax) */}
          <div
            ref={glowRef}
            data-hero-glow
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(120%_70%_at_78%_-6%,var(--gold-soft)_0%,transparent_42%),radial-gradient(90%_60%_at_8%_8%,var(--accent-muted)_0%,transparent_46%)] will-change-transform"
          />
          <div className="relative z-[1] mx-auto grid max-w-[1200px] items-center gap-[54px] px-0 pt-[78px] pb-24 [perspective:1400px] lg:grid-cols-[1.05fr_.95fr]">
            {/* left column */}
            <div data-reveal className={revealClass}>
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-line bg-surface px-[13px] py-1.5 text-[12px] font-semibold tracking-[.04em] text-gold-text shadow-card">
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 rounded-full bg-gold"
                />
                {t.heroEyebrow}
              </span>
              <h1 className="mt-[22px] font-display text-[clamp(48px,8vw,78px)] font-semibold leading-[1.02] tracking-[-.01em] text-text [text-wrap:balance]">
                <span className="block">{t.heroTitleLine1}</span>
                <span className="block">
                  <span className="italic text-gold-text">
                    {t.heroTitleEmph}
                  </span>{" "}
                  {t.heroTitleRest}
                </span>
              </h1>
              <p className="mt-[26px] max-w-[486px] text-[17px] leading-[1.62] text-text-soft [text-wrap:pretty]">
                {t.heroLead}
              </p>
              <div className="mt-[34px] flex flex-wrap gap-3">
                {/* Deepened gold gradient (vs the design's gold→gold-deep) so
                    the white label clears WCAG-AA (≥4.5:1) across the whole
                    button face; still theme-aware via --gold-deep. */}
                <Link
                  ref={heroCtaRef}
                  href={routes.projects()}
                  className="flex h-[50px] items-center gap-[9px] rounded-[12px] bg-[linear-gradient(145deg,color-mix(in_srgb,var(--gold-deep)_94%,black)_0%,color-mix(in_srgb,var(--gold-deep)_78%,black)_100%)] px-[26px] text-[15px] font-semibold text-white no-underline shadow-[0_8px_24px_color-mix(in_srgb,var(--gold)_38%,transparent)] active:scale-[.97]"
                >
                  {t.heroCtaPrimary}
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={scrollToShowcase}
                  className="flex h-[50px] items-center gap-[9px] rounded-[12px] border border-border-strong bg-surface px-[22px] text-[15px] font-semibold text-text transition-transform hover:-translate-y-px active:scale-[.97]"
                >
                  <Play
                    size={15}
                    strokeWidth={1.8}
                    fill="currentColor"
                    aria-hidden="true"
                  />
                  {t.heroCtaSecondary}
                </button>
              </div>
              <div className="mt-[44px] flex flex-wrap gap-[30px]">
                <div>
                  <div className="font-display text-[30px] font-semibold text-text">
                    {t.statLocalValue}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    {t.statLocalLabel}
                  </div>
                </div>
                <div aria-hidden="true" className="w-px bg-border" />
                <div>
                  <div className="font-display text-[30px] font-semibold text-text">
                    {t.statCodexValue}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    {t.statCodexLabel}
                  </div>
                </div>
                <div aria-hidden="true" className="w-px bg-border" />
                <div>
                  <div className="font-display text-[30px] font-semibold text-text">
                    {t.statRewriteValue}
                  </div>
                  <div className="text-[12.5px] text-text-muted">
                    {t.statRewriteLabel}
                  </div>
                </div>
              </div>
            </div>

            {/* right column — floating editor mock */}
            <div data-reveal className={revealClass}>
              {/* Tilt wrapper (design #woaHeroTilt): the JS lerp writes
                  rotateY/rotateX here; the .4s soft transition adds the
                  mock's extra smoothing. Separate from the reveal element so
                  the two transforms never fight. */}
              <div
                ref={heroTiltRef}
                data-hero-tilt
                className="relative transition-transform duration-[400ms] ease-[var(--ease-soft)] will-change-transform [transform-style:preserve-3d]"
              >
              {/* floating AI-suggestion popover — decorative; hidden below sm
                  where it would otherwise overlap the manuscript-card title */}
              <div className="absolute -top-[26px] -right-2 z-[2] hidden w-[228px] flex-col gap-[9px] rounded-[14px] border border-ai-muted bg-surface p-[14px] shadow-popover motion-safe:animate-[woaLandFloat_6s_ease-in-out_infinite] sm:flex">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-ai-muted text-ai">
                    <Sparkles size={14} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <span className="text-[12px] font-semibold text-ai-text">
                    {t.mockAiTitle}
                  </span>
                  <span className="ml-auto text-[10px] font-semibold text-text-muted">
                    {t.mockModel}
                  </span>
                </div>
                <p className="m-0 font-serif text-[12.5px] leading-[1.55] text-text-soft">
                  {t.mockAiSuggestion}
                </p>
                <div className="flex gap-[7px]">
                  <span className="flex-1 rounded-lg bg-success-muted py-1.5 text-center text-[11px] font-semibold text-success-text">
                    {t.mockAccept}
                  </span>
                  <span className="flex-1 rounded-lg bg-surface-muted py-1.5 text-center text-[11px] font-semibold text-text-muted">
                    {t.mockReject}
                  </span>
                </div>
              </div>
              {/* manuscript card */}
              <div className="overflow-hidden rounded-[18px] border border-border bg-surface-soft shadow-modal">
                <div className="flex items-center gap-[7px] border-b border-border bg-surface px-4 py-[13px]">
                  <span className="h-2.5 w-2.5 rounded-full bg-danger opacity-50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-warning opacity-50" />
                  <span className="h-2.5 w-2.5 rounded-full bg-success opacity-50" />
                  <span className="ml-2.5 text-[11.5px] text-text-muted">
                    {t.mockTabLabel}
                  </span>
                </div>
                <div className="px-[34px] pt-[30px] pb-9">
                  <div className="mb-[14px] font-display text-[13px] uppercase tracking-[.16em] text-gold-text">
                    {t.mockChapterEyebrow}
                  </div>
                  <div className="mb-[18px] font-serif text-[24px] font-semibold text-text">
                    {t.mockChapterTitle}
                  </div>
                  <p className="mb-[13px] font-serif text-[15.5px] leading-[1.78] text-text-soft [text-wrap:pretty]">
                    {t.mockPara1}
                  </p>
                  <p className="m-0 font-serif text-[15.5px] leading-[1.78] text-text-soft [text-wrap:pretty]">
                    {t.mockPara2Lead}
                    <span className="rounded-[3px] bg-ai-muted px-0.5 text-ai-text">
                      {t.mockPara2Emph}
                    </span>
                    <span
                      aria-hidden="true"
                      className="ml-px inline-block h-[1.05em] w-0.5 -translate-y-0.5 bg-accent align-text-bottom motion-safe:animate-[woaLandCaret_1.1s_step-end_infinite]"
                    />
                  </p>
                </div>
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── trust strip ────────────────────────────────────────────── */}
        <section
          data-reveal
          className={`border-y border-border bg-surface-soft ${revealClass}`}
        >
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-[18px] px-7 py-5">
            <span className="text-[12px] font-semibold uppercase tracking-[.08em] text-text-muted">
              {t.trustEyebrow}
            </span>
            <div className="flex flex-wrap items-center gap-x-[26px] gap-y-2 text-[13px] text-text-muted">
              {[
                t.trustHumanLoop,
                t.trustVersioning,
                t.trustOllama,
                t.trustExport,
              ].map((label) => (
                <span key={label} className="flex items-center gap-[7px]">
                  <Check
                    size={15}
                    strokeWidth={1.8}
                    className="text-success"
                    aria-hidden="true"
                  />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── features ───────────────────────────────────────────────── */}
        <section
          id="funkciok"
          className="mx-auto max-w-[1200px] scroll-mt-[84px] px-7 pt-28 pb-11"
        >
          <div data-reveal className={`max-w-[640px] ${revealClass}`}>
            <div className="mb-[14px] text-[12px] font-semibold uppercase tracking-[.14em] text-gold-text">
              {t.featuresEyebrow}
            </div>
            <h2 className="m-0 font-display text-[clamp(34px,5vw,48px)] font-semibold leading-[1.08] text-text [text-wrap:balance]">
              {t.featuresTitleLine1}
              <br />
              {t.featuresTitleLine2}
            </h2>
          </div>
          {/* Stagger reveal: ONE trigger on the grid; the cards rise with
              incremental delays (see the .woa-land-stagger style block). */}
          <div
            data-reveal
            className="woa-land-stagger mt-[44px] grid gap-[18px] sm:grid-cols-2"
          >
            {t.pillars.map((pillar, i) => {
              // Crash-proof: if the i18n pillar list ever grows past the icon
              // tuple, fall back to a known icon instead of rendering undefined.
              const Icon = PILLAR_ICONS[i] ?? Database;
              return (
                <div
                  key={pillar.title}
                  className="woa-lift rounded-[16px] border border-border bg-surface p-[26px] shadow-card"
                >
                  <span className="flex h-[46px] w-[46px] items-center justify-center rounded-[12px] bg-surface-muted text-accent-text">
                    <Icon size={22} strokeWidth={1.7} aria-hidden="true" />
                  </span>
                  <h3 className="mt-[18px] mb-2 font-display text-[25px] font-semibold text-text">
                    {pillar.title}
                  </h3>
                  <p className="m-0 text-[14.5px] leading-[1.6] text-text-muted [text-wrap:pretty]">
                    {pillar.body}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── philosophy band ────────────────────────────────────────── */}
        <section
          id="elv"
          data-reveal
          className={`mx-auto mt-28 max-w-[1200px] scroll-mt-[84px] px-7 ${revealClass}`}
        >
          <div className="relative overflow-hidden rounded-[24px] border border-border bg-[linear-gradient(135deg,var(--surface)_0%,var(--surface-muted)_100%)] px-[56px] py-16 max-md:px-7">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -top-10 -right-10 h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,var(--accent-muted)_0%,transparent_70%)]"
            />
            <div className="relative max-w-[720px]">
              <span className="inline-flex items-center gap-2 rounded-full bg-ai-muted px-3 py-[5px] text-[12px] font-semibold text-ai-text">
                <Sparkles size={13} strokeWidth={1.7} aria-hidden="true" />
                {t.philosophyEyebrow}
              </span>
              <p className="mt-[22px] font-display text-[clamp(28px,4.5vw,38px)] font-medium leading-[1.22] text-text [text-wrap:balance]">
                {t.philosophyQuoteOpen}
                <span className="italic text-ai-text">
                  {t.philosophyQuoteEmph1}
                </span>
                {t.philosophyQuoteMid}
                <span className="italic text-gold-text">
                  {t.philosophyQuoteEmph2}
                </span>
                {t.philosophyQuoteClose}
              </p>
              <p className="mt-[22px] max-w-[560px] text-[15px] leading-[1.65] text-text-soft">
                {t.philosophyBody}
              </p>
            </div>
          </div>
        </section>

        {/* ── showcase (3-panel cockpit) ─────────────────────────────── */}
        <section
          id="muhely"
          data-reveal
          className={`mx-auto mt-28 max-w-[1200px] scroll-mt-[84px] px-7 text-center ${revealClass}`}
        >
          <div className="mb-[14px] text-[12px] font-semibold uppercase tracking-[.14em] text-gold-text">
            {t.showcaseEyebrow}
          </div>
          <h2 className="mx-auto m-0 max-w-[680px] font-display text-[clamp(34px,5vw,46px)] font-semibold leading-[1.1] text-text">
            {t.showcaseTitle}
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[15.5px] text-text-muted">
            {t.showcaseSubtitle}
          </p>
          {/* Own horizontal-scroll container so the page body never scrolls sideways. */}
          <div className="woa-scroll mt-10 overflow-x-auto rounded-[18px] border border-border shadow-modal">
            <div className="grid h-[380px] min-w-[660px] grid-cols-[200px_1fr_230px] bg-surface text-left">
              {/* chapter list */}
              <div className="border-r border-border bg-bg-subtle px-[14px] py-[18px]">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.06em] text-text-muted">
                  {t.showcaseChaptersLabel}
                </div>
                <div className="flex flex-col gap-[3px]">
                  <div className="rounded-lg px-[10px] py-2 text-[13px] text-text-soft">
                    {t.showcaseChapter1}
                  </div>
                  <div className="rounded-lg border-l-2 border-accent bg-accent-muted px-[10px] py-2 text-[13px] font-semibold text-accent-text">
                    {t.showcaseChapter2}
                  </div>
                  <div className="rounded-lg py-2 pr-[10px] pl-[22px] text-[12.5px] text-text-muted">
                    {t.showcaseScene}
                  </div>
                  <div className="rounded-lg px-[10px] py-2 text-[13px] text-text-soft">
                    {t.showcaseChapter3}
                  </div>
                </div>
              </div>
              {/* manuscript */}
              <div className="bg-surface-soft px-[44px] py-9">
                <div className="mb-[14px] font-serif text-[20px] font-semibold text-text">
                  {t.showcaseManuscriptTitle}
                </div>
                <p className="mb-[11px] font-serif text-[14.5px] leading-[1.8] text-text-soft">
                  {t.showcaseManuscriptP1}
                </p>
                <p className="m-0 font-serif text-[14.5px] leading-[1.8] text-text-soft">
                  {t.showcaseManuscriptP2}
                </p>
              </div>
              {/* AI panel */}
              <div className="border-l border-border bg-bg-subtle px-[14px] py-[18px]">
                <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.06em] text-ai-text">
                  {t.showcaseAiLabel}
                </div>
                <div className="rounded-[12px] border border-ai-muted bg-surface p-3">
                  <div className="relative mb-2.5 h-[5px] overflow-hidden rounded-full bg-accent-muted">
                    <span className="absolute inset-y-0 left-0 w-[42%] rounded-full bg-[linear-gradient(90deg,transparent,var(--accent)_42%,var(--ai)_72%,transparent)] motion-safe:animate-[woaLandBar_1.5s_cubic-bezier(.45,0,.25,1)_infinite]" />
                  </div>
                  <div className="text-[11.5px] text-text-muted">
                    {t.showcaseAiStatus}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── footer CTA band ────────────────────────────────────────── */}
        <section
          data-reveal
          className={`mx-auto mt-28 max-w-[1200px] px-7 ${revealClass}`}
        >
          <div className="rounded-[24px] border border-gold-line bg-[linear-gradient(160deg,var(--gold-soft)_0%,var(--surface)_70%)] px-10 py-[72px] text-center">
            <h2 className="mx-auto m-0 max-w-[600px] font-display text-[clamp(38px,6vw,52px)] font-semibold leading-[1.08] text-text">
              {t.footerCtaTitle}
            </h2>
            <p className="mx-auto mt-4 max-w-[440px] text-[16px] text-text-soft">
              {t.footerCtaBody}
            </p>
            <Link
              ref={footerCtaRef}
              href={routes.projects()}
              className="mt-[30px] inline-flex h-[52px] items-center gap-[9px] rounded-[12px] bg-text px-[30px] text-[15px] font-semibold text-bg no-underline active:scale-[.97]"
            >
              {t.enterApp}
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      {/* ── footer ───────────────────────────────────────────────────── */}
      <footer className="mx-auto mt-16 flex max-w-[1200px] flex-wrap items-center justify-between gap-[14px] border-t border-border p-7">
        <div className="flex items-center gap-2.5">
          <StarTile size={26} />
          <span className="font-hand text-[24px] font-bold leading-none text-gold-text">
            {t.wordmark}
          </span>
        </div>
        <span className="text-[12.5px] text-text-muted">{t.footerTagline}</span>
      </footer>
    </div>
  );
}
