"use client";

/**
 * Áttekintés (Overview / book dashboard) — the landing screen for a book.
 *
 * Faithful translation of the `Alexandria.current.html` OVERVIEW section
 * (gold radial-wash hero, aggregate stat cards, a synopsis + per-chapter
 * progress card, a plotlines preview, quick actions, and a style-guide
 * callout) into React + the semantic Tailwind tokens.
 *
 * ALL numbers are derived from REAL data:
 *   - book title / synopsis / genre / author / word_count_target → useResolvedBook
 *   - chapters + their scenes (per-chapter progress, word + scene aggregates)
 *     → useBookTree
 *   - plotlines preview → usePlotlines (scoped to the resolved book's project)
 *
 * Per-chapter progress = completed scenes / total scenes (a chapter with 2 of 4
 * scenes `complete` reads 50%). Loading → skeleton, error → ErrorState, a book
 * with no chapters → EmptyState. Quick actions navigate to the real routes
 * (Codex, plan, Stíluskalauz). Nothing without a cheap data source is fabricated.
 */
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  PenLine,
  Users,
  ScrollText,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { ProgressBar } from "@/components/kit/progress-bar";
import { ErrorState } from "@/components/kit/error-state";
import { EmptyState } from "@/components/kit/empty-state";
import { Skeleton } from "@/components/kit/skeleton";
import { GenerateBookDialog } from "@/components/overview/generate-book-dialog";
import { hu } from "@/lib/i18n/hu";
import { useResolvedBook } from "@/lib/api/export-hooks";
import { useBookTree, usePlotlines } from "@/lib/api/hooks";
import type { ChapterWithScenes } from "@/lib/api/hooks";
import type { PlotlineRead } from "@/lib/api/types";

const t = hu.overview;

/** A scene counts as finished when its status is `complete`. */
function isSceneDone(status: string): boolean {
  return status === "complete";
}

interface ChapterProgress {
  id: string;
  title: string;
  /** Completed scenes / total scenes, rounded to a whole percent. */
  pct: number;
  /** Summed word count across the chapter's scenes. */
  words: number;
  /** Human status word derived from the completion ratio. */
  statusWord: string;
}

/** Derive a chapter's progress + word total from its scenes. */
function chapterProgress(chapter: ChapterWithScenes): ChapterProgress {
  const total = chapter.scenes.length;
  const done = chapter.scenes.filter((s) => isSceneDone(s.status)).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const words = chapter.scenes.reduce((sum, s) => sum + s.word_count, 0);
  const statusWord =
    pct >= 100 ? t.chapterDone : pct === 0 ? t.chapterDraft : t.chapterInProgress;
  return { id: chapter.id, title: chapter.title, pct, words, statusWord };
}

/** The dot colour for a plotline preview row (cycles the POV palette). */
const PLOTLINE_DOT_CLASS = [
  "bg-pov2-tx",
  "bg-pov3-tx",
  "bg-pov4-tx",
  "bg-pov5-tx",
] as const;

export function OverviewScreen() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;
  const router = useRouter();

  const bookQuery = useResolvedBook(bookId);
  const tree = useBookTree(bookId);
  const projectId = bookQuery.data?.project_id;
  const plotlinesQuery = usePlotlines(projectId);

  // Book automation (V2): the hero-level "Könyv generálása" dialog.
  const [generateOpen, setGenerateOpen] = useState(false);

  const book = bookQuery.data;
  const chapters = tree.chapters;

  const aggregates = useMemo(() => {
    const perChapter = chapters.map(chapterProgress);
    const totalScenes = chapters.reduce((n, c) => n + c.scenes.length, 0);
    const doneScenes = chapters.reduce(
      (n, c) => n + c.scenes.filter((s) => isSceneDone(s.status)).length,
      0,
    );
    const totalWords = perChapter.reduce((n, c) => n + c.words, 0);
    const overallPct =
      totalScenes > 0 ? Math.round((doneScenes / totalScenes) * 100) : 0;
    return {
      perChapter,
      totalScenes,
      totalWords,
      chapterCount: chapters.length,
      overallPct,
    };
  }, [chapters]);

  // --- Loading: the book is the screen's spine; wait for it (+ first tree pass).
  if (bookQuery.isLoading || (bookId && tree.isLoading && chapters.length === 0)) {
    return <OverviewSkeleton />;
  }

  // --- Error: the book did not resolve, or the chapter tree failed.
  if (bookQuery.isError || !book || tree.isError) {
    const detail = bookQuery.error?.message ?? tree.error?.message;
    return (
      <OverviewShell>
        <ErrorState
          message={t.errorTitle}
          detail={detail}
          onRetry={() => {
            void bookQuery.refetch();
            tree.refetch();
          }}
        />
      </OverviewShell>
    );
  }

  // --- Empty: a resolved book with no chapters yet.
  if (aggregates.chapterCount === 0) {
    return (
      <OverviewShell>
        <BookHero
          title={book.title}
          author={book.author}
          genre={book.genre}
          onContinue={() => router.push(`/konyv/${bookId}/terv`)}
        />
        <EmptyState
          title={t.emptyTitle}
          description={t.emptyDescription}
          action={{
            label: t.emptyAction,
            onClick: () => router.push(`/konyv/${bookId}/terv`),
          }}
        />
      </OverviewShell>
    );
  }

  const plotlines = (plotlinesQuery.data ?? []).slice(0, 3);

  return (
    <OverviewShell>
      <BookHero
        title={book.title}
        author={book.author}
        genre={book.genre}
        onContinue={() => router.push(`/konyv/${bookId}/terv`)}
        onGenerate={() => setGenerateOpen(true)}
      />

      {bookId ? (
        <GenerateBookDialog
          bookId={bookId}
          open={generateOpen}
          onOpenChange={setGenerateOpen}
        />
      ) : null}

      {/* Aggregate stat cards. */}
      <div className="mb-[18px] grid grid-cols-2 gap-3.5 sm:grid-cols-4">
        <StatCard
          value={aggregates.totalWords.toLocaleString("hu-HU")}
          label={t.statWords(book.word_count_target)}
        />
        <StatCard value={String(aggregates.chapterCount)} label={t.statChapters} />
        <StatCard value={String(aggregates.totalScenes)} label={t.statScenes} />
        <StatCard
          value={`${aggregates.overallPct}%`}
          label={t.statProgress}
          gold
        />
      </div>

      {/* Synopsis + chapter progress | plotlines + quick actions. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-text-muted">
            {t.synopsisLabel}
          </h2>
          <p className="m-0 mb-[18px] font-serif text-[15px] leading-[1.7] text-text-soft [text-wrap:pretty]">
            {book.synopsis ?? t.synopsisEmpty}
          </p>
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-[.07em] text-text-muted">
            {t.chaptersLabel}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-[13px] p-0">
            {aggregates.perChapter.map((c) => (
              <li key={c.id}>
                <div className="mb-[5px] flex justify-between">
                  <span className="text-[13px] font-medium text-text">
                    {c.title}
                  </span>
                  <span className="tabular-nums text-[11px] text-text-muted">
                    {t.chapterMeta(c.words, c.statusWord)}
                  </span>
                </div>
                <ProgressBar value={c.pct} aria-label={c.title} />
              </li>
            ))}
          </ul>
        </section>

        <aside className="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[.07em] text-text-muted">
            {t.plotlinesLabel}
          </h2>
          {plotlines.length > 0 ? (
            <ul className="m-0 flex list-none flex-col gap-[11px] p-0">
              {plotlines.map((p, i) => (
                <PlotlineRow key={p.id} plotline={p} index={i} />
              ))}
            </ul>
          ) : (
            <p className="m-0 text-[13px] text-text-muted">{t.plotlinesEmpty}</p>
          )}

          <div className="my-4 h-px bg-border" />

          <h2 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[.07em] text-text-muted">
            {t.quickActionsLabel}
          </h2>
          <div className="flex flex-col gap-[7px]">
            <QuickAction
              icon={<Users size={15} className="text-accent-text" strokeWidth={1.7} />}
              label={t.actionAddCharacter}
              onClick={() => router.push(`/konyv/${bookId}/codex`)}
            />
            <QuickAction
              icon={
                <ScrollText size={15} className="text-gold-text" strokeWidth={1.7} />
              }
              label={t.actionStyleGuide}
              onClick={() => router.push(`/konyv/${bookId}/stiluskalauz`)}
            />
          </div>
        </aside>
      </div>

      {/* Style-guide callout (gold wash). */}
      <button
        type="button"
        aria-label={t.styleGuideCalloutAria}
        onClick={() => router.push(`/konyv/${bookId}/stiluskalauz`)}
        className="mt-4 flex w-full items-center gap-4 rounded-2xl border border-gold-line bg-[linear-gradient(135deg,var(--gold-soft)_0%,var(--surface)_70%)] p-[18px_22px] text-left shadow-card transition-transform hover:-translate-y-0.5 hover:shadow-hover motion-reduce:transition-none motion-reduce:hover:translate-y-0"
      >
        <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-xl border border-gold-line bg-surface text-gold-text shadow-card">
          <ScrollText size={22} strokeWidth={1.7} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="mb-[3px] flex flex-wrap items-center gap-[9px]">
            <span className="font-display text-[19px] font-semibold text-text">
              {t.styleGuideTitle}
            </span>
            <span className="flex gap-[5px]">
              {t.styleGuideChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-gold-line bg-surface px-[9px] py-px text-[11px] font-semibold text-gold-text"
                >
                  {chip}
                </span>
              ))}
            </span>
          </span>
          <span className="block text-[13px] text-text-muted">
            {t.styleGuideDescription}
          </span>
        </span>
        <ChevronRight
          size={18}
          strokeWidth={1.9}
          aria-hidden="true"
          className="flex-none text-text-faint"
        />
      </button>
    </OverviewShell>
  );
}

/** The gold radial-wash scrolling wrapper shared by every state. */
function OverviewShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(120%_50%_at_50%_-12%,var(--gold-soft)_0%,transparent_46%)] px-10 pb-20 pt-11">
      <div className="mx-auto max-w-[900px]">{children}</div>
    </div>
  );
}

/** The gold book-spine hero card: cover chip, eyebrow, title, meta, CTA(s). */
function BookHero({
  title,
  author,
  genre,
  onContinue,
  onGenerate,
}: {
  title: string;
  author: string | null;
  genre: string | null;
  onContinue: () => void;
  /** Opens the book-level "Könyv generálása" dialog (omitted on empty books). */
  onGenerate?: () => void;
}) {
  const meta = [author, genre].filter(Boolean).join(" · ");
  return (
    <div className="mb-[26px] flex items-end gap-[22px]">
      <span
        aria-hidden="true"
        className="flex h-[150px] w-[108px] flex-none flex-col items-center justify-end rounded-lg bg-[linear-gradient(155deg,#c79447_0%,#9a6f2c_52%,#6c4c1c_100%)] p-[16px_12px] shadow-hover [box-shadow:inset_0_0_0_1px_rgba(238,214,150,.3),inset_6px_0_0_rgba(0,0,0,.2),var(--shadow-hover)]"
      >
        <span className="text-center font-display text-[18px] font-semibold leading-[1.1] text-[#f6efdd] [text-shadow:0_1px_6px_rgba(0,0,0,.3)]">
          {title}
        </span>
      </span>
      <div className="min-w-0 flex-1 pb-1">
        <span className="mb-2.5 flex items-center gap-[11px]">
          <span aria-hidden="true" className="h-px w-[26px] bg-gold-line" />
          <span className="text-[11px] font-semibold uppercase tracking-[.16em] text-gold-text">
            {t.eyebrow}
          </span>
        </span>
        <h1 className="m-0 font-display text-[38px] font-semibold leading-[1.04] text-text">
          {title}
        </h1>
        {meta ? (
          <p className="mt-2 text-[13px] text-text-muted">{meta}</p>
        ) : null}
      </div>
      <div className="flex flex-none items-center gap-2.5 pb-1">
        {onGenerate ? (
          <button
            type="button"
            onClick={onGenerate}
            className="inline-flex h-[42px] flex-none items-center gap-2 rounded-[11px] border border-ai/40 bg-ai-muted px-[18px] text-sm font-semibold text-ai-text transition-colors hover:bg-ai hover:text-ai-fg"
          >
            <Sparkles size={15} strokeWidth={1.8} aria-hidden="true" />
            {hu.bookGen.trigger}
          </button>
        ) : null}
        <button
          type="button"
          onClick={onContinue}
          className="inline-flex h-[42px] flex-none items-center gap-2 rounded-[11px] bg-[linear-gradient(145deg,var(--gold),var(--gold-deep))] px-[18px] text-sm font-semibold text-white [box-shadow:0_8px_20px_color-mix(in_srgb,var(--gold)_34%,transparent)]"
        >
          <PenLine size={15} strokeWidth={1.8} aria-hidden="true" />
          {t.continueWriting}
        </button>
      </div>
    </div>
  );
}

/** A bracketed aggregate stat card (big display number + muted label). */
function StatCard({
  value,
  label,
  gold,
}: {
  value: string;
  label: string;
  gold?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-border bg-surface p-4 shadow-card">
      <div
        className={`font-display text-[28px] font-semibold ${gold ? "text-gold-text" : "text-text"}`}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-text-muted">{label}</div>
    </div>
  );
}

/** A plotline preview row: colour dot, title, and a main/sub kind label. */
function PlotlineRow({
  plotline,
  index,
}: {
  plotline: PlotlineRead;
  index: number;
}) {
  const isMain = plotline.plotline_type === "main_plot";
  return (
    <li className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`h-2 w-2 flex-none rounded-full ${PLOTLINE_DOT_CLASS[index % PLOTLINE_DOT_CLASS.length]}`}
      />
      <span className="flex-1 truncate text-[13px] text-text-soft">
        {plotline.title}
      </span>
      <span className="text-[11px] text-text-muted">
        {isMain ? t.plotlineMain : t.plotlineSub}
      </span>
    </li>
  );
}

/** A quick-action button row (icon + label, navigates on click). */
function QuickAction({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[9px] rounded-[10px] border border-border bg-surface px-[11px] py-[9px] text-left text-[13px] font-medium text-text-soft transition-colors hover:border-border-strong hover:text-text"
    >
      <span aria-hidden="true" className="flex-none">
        {icon}
      </span>
      {label}
    </button>
  );
}

/** Loading placeholder — mirrors the hero + stat-card + two-column layout. */
function OverviewSkeleton() {
  return (
    <div
      data-testid="overview-skeleton"
      aria-busy="true"
      aria-label={t.loadingAria}
      className="min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(120%_50%_at_50%_-12%,var(--gold-soft)_0%,transparent_46%)] px-10 pb-20 pt-11"
    >
      <div className="mx-auto max-w-[900px]">
        <div className="mb-[26px] flex items-end gap-[22px]">
          <Skeleton width={108} height={150} className="flex-none rounded-lg" />
          <div className="flex-1">
            <Skeleton width={140} height={12} className="mb-3" />
            <Skeleton width="60%" height={36} />
          </div>
        </div>
        <div className="mb-[18px] grid grid-cols-2 gap-3.5 sm:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={72} className="rounded-[14px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.5fr_1fr]">
          <Skeleton height={220} className="rounded-2xl" />
          <Skeleton height={220} className="rounded-2xl" />
        </div>
      </div>
    </div>
  );
}
