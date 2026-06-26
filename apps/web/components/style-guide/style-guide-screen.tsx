"use client";

/**
 * Stíluskalauz (Style Guide) screen — a faithful copy of the Claude Design
 * canvas `data-screen-label="Stíluskalauz"` section (Alexandria.current.html
 * ~1400–1466), bound to the project-scoped backend StyleGuide.
 *
 * Schema mapping (the backend model is `tone`/`pov`/`tense` typed columns +
 * freeform `rules`/`examples` JSON dicts — NO new fields invented here):
 *   • voice chips   ← tone, pov, tense (the typed columns)
 *   • pillar cards  ← rules.pillars: [{ key, value, description }]
 *   • Kövesd list   ← rules.do: string[]
 *   • Kerüld list   ← rules.dont: string[]
 *   • banned words  ← rules.banned: string[]
 *   • sample        ← examples.sample (fallback: notes)
 *
 * Read-only in this slice — the "Szerkesztés" / "Létrehozás" actions are honest
 * stubs (a toast); a structured editor over `rules`/`examples` is a follow-up.
 */
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { Check, X, Pencil, Sparkle, Quote, ScrollText } from "lucide-react";
import { Icon } from "@/components/kit/icon";
import { Button } from "@/components/kit/button";
import { PageHero } from "@/components/kit/page-hero";
import { Skeleton } from "@/components/kit/skeleton";
import { ErrorState } from "@/components/kit/error-state";
import { EmptyState } from "@/components/kit/empty-state";
import { toast } from "@/components/kit/toast";
import { hu } from "@/lib/i18n/hu";
import { useResolvedBook } from "@/lib/api/export-hooks";
import { useStyleGuide } from "@/lib/api/style-guide-hooks";
import type { StyleGuideRead } from "@/lib/api/types";

/** A single style pillar parsed out of `rules.pillars`. */
interface Pillar {
  key: string;
  value: string;
  description: string;
}

/** Everything the view needs, derived from the raw StyleGuide. */
interface StyleGuideView {
  voiceChips: string[];
  pillars: Pillar[];
  doList: string[];
  dontList: string[];
  banned: string[];
  sample: string | null;
}

/** Coerce an unknown JSON value to a clean string[] (drops blanks/non-strings). */
function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
}

/** Parse `rules.pillars` into typed Pillars, tolerating partial entries. */
function toPillars(value: unknown): Pillar[] {
  if (!Array.isArray(value)) return [];
  const pillars: Pillar[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const key = typeof rec.key === "string" ? rec.key : "";
    const val = typeof rec.value === "string" ? rec.value : "";
    const description =
      typeof rec.description === "string" ? rec.description : "";
    // A pillar needs at least a key or a value to be worth rendering.
    if (key || val) pillars.push({ key, value: val, description });
  }
  return pillars;
}

/** Map the raw StyleGuide onto the view model. */
function toView(sg: StyleGuideRead): StyleGuideView {
  const rules = (sg.rules ?? {}) as Record<string, unknown>;
  const examples = (sg.examples ?? {}) as Record<string, unknown>;
  const voiceChips = [sg.tone, sg.pov, sg.tense].filter(
    (v): v is string => typeof v === "string" && v.trim().length > 0,
  );
  const exampleSample =
    typeof examples.sample === "string" && examples.sample.trim().length > 0
      ? examples.sample
      : null;
  const noteSample =
    sg.notes && sg.notes.trim().length > 0 ? sg.notes : null;
  const sample = exampleSample ?? noteSample;
  return {
    voiceChips,
    pillars: toPillars(rules.pillars),
    doList: toStringList(rules.do),
    dontList: toStringList(rules.dont),
    banned: toStringList(rules.banned),
    sample,
  };
}

/** Shared scrolling page frame with the gold radial wash from the design. */
function ScreenFrame({ children }: { readonly children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-10 py-11 [background:radial-gradient(120%_50%_at_50%_-12%,var(--gold-soft)_0%,transparent_46%)]">
      <div className="mx-auto max-w-[880px]">{children}</div>
    </div>
  );
}

export function StyleGuideScreen() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;

  const bookQuery = useResolvedBook(bookId);
  const projectId = bookQuery.data?.project_id;
  const sgQuery = useStyleGuide(projectId);

  const view = useMemo(
    () => (sgQuery.data ? toView(sgQuery.data) : null),
    [sgQuery.data],
  );

  const isLoading =
    !bookId ||
    bookQuery.isLoading ||
    (Boolean(projectId) && sgQuery.isLoading);

  // A 404 from the style-guide endpoint = "no guide yet" → empty state. The
  // book-resolution failure or any non-404 = a real error.
  const isMissing = sgQuery.isError && sgQuery.error?.status === 404;
  const isError =
    bookQuery.isError || (sgQuery.isError && sgQuery.error?.status !== 404);

  const header = (
    <PageHero
      eyebrow={hu.styleGuide.eyebrow}
      title={hu.styleGuide.title}
      subtitle={hu.styleGuide.heroSubtitle}
      action={
        view ? (
          <Button
            variant="secondary"
            size={34}
            leadingIcon={<Icon icon={Pencil} size={15} />}
            onClick={() => toast.info(hu.styleGuide.editStubToast)}
          >
            {hu.styleGuide.editCta}
          </Button>
        ) : undefined
      }
    />
  );

  if (isLoading) {
    return (
      <ScreenFrame>
        {header}
        <div
          data-testid="style-guide-loading"
          className="flex flex-col gap-3.5"
          aria-busy="true"
        >
          <Skeleton height={64} className="rounded-2xl" />
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <Skeleton height={120} className="rounded-[14px]" />
            <Skeleton height={120} className="rounded-[14px]" />
            <Skeleton height={120} className="rounded-[14px]" />
            <Skeleton height={120} className="rounded-[14px]" />
          </div>
          <Skeleton height={130} className="rounded-2xl" />
        </div>
      </ScreenFrame>
    );
  }

  if (isError) {
    return (
      <ScreenFrame>
        {header}
        <ErrorState
          message={hu.styleGuide.errorTitle}
          detail={sgQuery.error?.message ?? bookQuery.error?.message}
          onRetry={() => {
            bookQuery.refetch();
            sgQuery.refetch();
          }}
        />
      </ScreenFrame>
    );
  }

  if (isMissing || !view) {
    return (
      <ScreenFrame>
        {header}
        <EmptyState
          icon={<Icon icon={ScrollText} size={22} />}
          title={hu.styleGuide.emptyTitle}
          description={hu.styleGuide.emptyBody}
          action={{
            label: hu.styleGuide.emptyCta,
            onClick: () => toast.info(hu.styleGuide.emptyStubToast),
          }}
        />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame>
      {header}

      {/* Narrator-voice strip + chips. */}
      {view.voiceChips.length > 0 ? (
        <div className="mb-3.5 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-[linear-gradient(135deg,var(--gold-soft)_0%,var(--surface)_72%)] px-5 py-[18px] shadow-card">
          <span className="text-[11px] font-semibold uppercase tracking-[.07em] text-gold-text">
            {hu.styleGuide.voiceLabel}
          </span>
          <div className="flex flex-wrap gap-2">
            {view.voiceChips.map((chip) => (
              <span
                key={chip}
                className="rounded-full border border-gold-line bg-surface px-3.5 py-[5px] font-display text-[15px] font-semibold text-gold-text"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Pillar cards. */}
      {view.pillars.length > 0 ? (
        <ul
          aria-label={hu.styleGuide.pillarsAria}
          className="mb-3.5 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2"
        >
          {view.pillars.map((pillar) => (
            <li
              key={pillar.key || pillar.value}
              className="rounded-[14px] border border-border bg-surface p-[17px_18px] shadow-card"
            >
              <div className="mb-2.5 flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-gold-soft text-gold-text"
                >
                  <Icon icon={Sparkle} size={16} />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[.05em] text-text-muted">
                  {pillar.key}
                </span>
              </div>
              <div className="mb-[5px] font-display text-[20px] font-semibold text-text">
                {pillar.value}
              </div>
              {pillar.description ? (
                <p className="m-0 text-[13px] leading-[1.55] text-text-muted">
                  {pillar.description}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Kövesd / Kerüld lists. */}
      {view.doList.length > 0 || view.dontList.length > 0 ? (
        <div className="mb-3.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <section className="rounded-[14px] border border-border bg-surface p-[18px_20px] shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text">
              <Icon
                icon={Check}
                size={16}
                aria-hidden="true"
                className="flex-none text-success-text"
              />
              {hu.styleGuide.doTitle}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {view.doList.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-success"
                  />
                  <span className="text-[13.5px] leading-[1.5] text-text-soft">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <section className="rounded-[14px] border border-border bg-surface p-[18px_20px] shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text">
              <Icon
                icon={X}
                size={16}
                aria-hidden="true"
                className="flex-none text-danger-text"
              />
              {hu.styleGuide.dontTitle}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
              {view.dontList.map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <span
                    aria-hidden="true"
                    className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-danger"
                  />
                  <span className="text-[13.5px] leading-[1.5] text-text-soft">
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}

      {/* Banned words. */}
      {view.banned.length > 0 ? (
        <div className="mb-3.5 rounded-[14px] border border-border bg-surface p-[18px_20px] shadow-card">
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-[.06em] text-text-muted">
            {hu.styleGuide.bannedLabel}
          </div>
          <div className="flex flex-wrap gap-2">
            {view.banned.map((word) => (
              <span
                key={word}
                className="inline-flex items-center gap-1.5 rounded-lg bg-danger-muted px-[11px] py-1 text-[12.5px] font-medium text-danger-text line-through [text-decoration-color:color-mix(in_srgb,var(--danger-text)_50%,transparent)]"
              >
                {word}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Etalon-passzus sample. */}
      {view.sample ? (
        <section className="relative overflow-hidden rounded-2xl border border-gold-line bg-[linear-gradient(160deg,var(--gold-soft)_0%,var(--surface)_70%)] p-[24px_28px]">
          <Icon
            icon={Quote}
            size={40}
            aria-hidden="true"
            className="pointer-events-none absolute left-[18px] top-[14px] text-gold-text opacity-[.18]"
          />
          <div className="relative mb-3 text-[11px] font-semibold uppercase tracking-[.07em] text-gold-text">
            {hu.styleGuide.sampleLabel}
          </div>
          <p className="relative m-0 font-serif text-[19px] leading-[1.8] text-text">
            {view.sample}
          </p>
          <div className="relative mt-4 flex items-center gap-2 border-t border-gold-line pt-3.5">
            <Icon
              icon={Sparkle}
              size={14}
              aria-hidden="true"
              className="flex-none text-ai-text"
            />
            <span className="text-[12.5px] text-ai-text">
              {hu.styleGuide.sampleAiNote}
            </span>
          </div>
        </section>
      ) : null}
    </ScreenFrame>
  );
}
