"use client";

/**
 * Borító — the AI cover generator panel for a book (Phase 2).
 *
 * Modelled closely on `apps/web/components/codex/image-panel.tsx` — same
 * MediaThumb subcomponent, same canonical ring + canonical-first ordering, same
 * hover/focus overlay actions (IconButton + Tooltip), same Skeleton-shimmer
 * generating tile with a caption, and the same Retry-on-failed action.
 *
 * Differences from the image panel:
 * - TWO pickers: art style (useCoverStyles) + layout (useCoverLayouts).
 * - Text inputs: title (prefilled bookTitle), author (prefilled bookAuthor),
 *   optional subtitle.
 * - Generate via useGenerateCover; error toast uses hu.covers.generateError.
 * - Gallery via useEntityImages("cover", bookId); canonical cover rendered as a
 *   larger "hero" preview above the thumbnail grid.
 * - All copy from hu.covers.
 */
import { useCallback, useEffect, useState } from "react";
import { ImageIcon, RotateCcw, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Spinner } from "@/components/kit/spinner";
import { Skeleton } from "@/components/kit/skeleton";
import { Icon } from "@/components/kit/icon";
import { IconButton } from "@/components/kit/icon-button";
import { DashedTile } from "@/components/kit/dashed-tile";
import { Tooltip } from "@/components/kit/tooltip";
import { ConfirmDialog } from "@/components/kit/alert-dialog";
import { SectionEyebrow } from "@/components/kit/section-eyebrow";
import { toast } from "@/components/kit/toast";
import { FormInput, FieldLabel } from "@/components/kit/form-input";
import {
  useDeleteImage,
  useEntityImages,
  useMediaObjectUrl,
  useSetCanonical,
} from "@/lib/api/image-hooks";
import { useCoverLayouts, useCoverStyles, useGenerateCover } from "@/lib/api/cover-hooks";
import type { MediaAssetRead } from "@/lib/api/image-types";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// MediaThumb — mirrors image-panel.tsx exactly (JWT-authenticated blob URL)
// ---------------------------------------------------------------------------

function MediaThumb({ assetId, alt }: { assetId: string; alt: string }) {
  const { url, isLoading, isError } = useMediaObjectUrl(assetId, { thumb: true });

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="flex h-5 items-center rounded-full bg-danger-muted px-2 text-[11px] font-semibold text-danger-text">
          {hu.covers.failedChip}
        </span>
      </div>
    );
  }
  if (isLoading || !url) {
    return (
      <div className="flex h-full w-full items-center justify-center text-text-muted">
        <Spinner size={20} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="h-full w-full object-cover" />
  );
}

// ---------------------------------------------------------------------------
// HeroThumb — larger authenticated thumbnail for the canonical cover preview
// ---------------------------------------------------------------------------

function HeroThumb({ assetId, alt }: { assetId: string; alt: string }) {
  // The ≤512px thumbnail is plenty sharp for the ~200×320 hero box and far
  // lighter than refetching the full 1600×2560 cover.
  const { url, isLoading, isError } = useMediaObjectUrl(assetId, { thumb: true });

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="flex h-5 items-center rounded-full bg-danger-muted px-2 text-[11px] font-semibold text-danger-text">
          {hu.covers.failedChip}
        </span>
      </div>
    );
  }
  if (isLoading || !url) {
    return (
      <div className="flex h-full w-full items-center justify-center text-text-muted">
        <Spinner size={24} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="h-full w-full object-contain" />
  );
}

// ---------------------------------------------------------------------------
// CoverPanel props
// ---------------------------------------------------------------------------

export interface CoverPanelProps {
  bookId: string;
  bookTitle: string;
  bookAuthor: string | null;
}

// ---------------------------------------------------------------------------
// CoverPanel — main exported component
// ---------------------------------------------------------------------------

export function CoverPanel({ bookId, bookTitle, bookAuthor }: CoverPanelProps) {
  const styles = useCoverStyles();
  const layouts = useCoverLayouts();
  const images = useEntityImages("cover", bookId);
  const generate = useGenerateCover();

  const [artStyle, setArtStyle] = useState("");
  const [layout, setLayout] = useState("");
  const [title, setTitle] = useState(bookTitle);
  const [author, setAuthor] = useState(bookAuthor ?? "");
  const [subtitle, setSubtitle] = useState("");

  // Default art-style picker to the first option once loaded.
  useEffect(() => {
    const options = styles.data ?? [];
    if (options.length === 0) return;
    setArtStyle((current) =>
      current && options.some((s) => s.slug === current) ? current : options[0].slug,
    );
  }, [styles.data]);

  // Default layout picker to the first option once loaded.
  useEffect(() => {
    const options = layouts.data ?? [];
    if (options.length === 0) return;
    setLayout((current) =>
      current && options.some((l) => l.slug === current) ? current : options[0].slug,
    );
  }, [layouts.data]);

  // Keep text inputs in sync when props change (e.g. parent reloads the book).
  useEffect(() => setTitle(bookTitle), [bookTitle]);
  useEffect(() => setAuthor(bookAuthor ?? ""), [bookAuthor]);

  const runGenerate = useCallback(
    (styleSlug: string, layoutSlug: string) => {
      if (!styleSlug || !layoutSlug) return;
      generate.mutate(
        { bookId, artStyle: styleSlug, layout: layoutSlug, title, author, subtitle: subtitle || null },
        { onError: (e) => toast.error(`${hu.covers.generateError}: ${e.message}`) },
      );
    },
    [generate, bookId, title, author, subtitle],
  );

  function handleGenerate() {
    runGenerate(artStyle, layout);
  }

  /** Human label for an art-style slug (fallback to slug). */
  function styleLabelFor(slug: string | null): string {
    if (!slug) return "";
    return (styles.data ?? []).find((s) => s.slug === slug)?.label ?? slug;
  }

  // Canonical cover first; within each group newest-first (backend order).
  const assets = [...(images.data ?? [])].sort(
    (a, b) => Number(b.is_canonical) - Number(a.is_canonical),
  );

  const canonicalAsset = assets.find((a) => a.is_canonical);

  const artStylePickerId = `cover-art-style-${bookId}`;
  const layoutPickerId = `cover-layout-${bookId}`;

  return (
    <section className="flex flex-col gap-4">
      <SectionEyebrow as="h3">{hu.covers.title}</SectionEyebrow>

      {/* Canonical cover hero preview */}
      {canonicalAsset?.status === "ready" ? (
        <div className="flex justify-center">
          <div className="relative h-[320px] w-[200px] overflow-hidden rounded-[12px] border-2 border-accent ring-2 ring-accent ring-offset-1 ring-offset-surface">
            <HeroThumb
              assetId={canonicalAsset.id}
              alt={hu.covers.heroAlt(title)}
            />
            <span className="absolute left-2 top-2 z-[2] flex h-5 items-center gap-1 rounded-full bg-accent-strong px-2 text-[10px] font-semibold text-accent-fg">
              <Icon icon={Star} size={10} />
              {hu.covers.canonicalBadge}
            </span>
          </div>
        </div>
      ) : null}

      {/* Generate controls */}
      <div className="flex flex-col gap-3">
        {/* Pickers row */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor={artStylePickerId}
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted"
            >
              {hu.covers.artStyleLabel}
            </label>
            <select
              id={artStylePickerId}
              aria-label={hu.covers.artStyleLabel}
              value={artStyle}
              onChange={(e) => setArtStyle(e.target.value)}
              disabled={(styles.data ?? []).length === 0}
              className="box-border h-9 w-full min-w-[180px] rounded-[10px] border border-border bg-surface px-3 text-[13px] text-text outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]"
            >
              {(styles.data ?? []).map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={layoutPickerId}
              className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted"
            >
              {hu.covers.layoutLabel}
            </label>
            <select
              id={layoutPickerId}
              aria-label={hu.covers.layoutLabel}
              value={layout}
              onChange={(e) => setLayout(e.target.value)}
              disabled={(layouts.data ?? []).length === 0}
              className="box-border h-9 w-full min-w-[180px] rounded-[10px] border border-border bg-surface px-3 text-[13px] text-text outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]"
            >
              {(layouts.data ?? []).map((l) => (
                <option key={l.slug} value={l.slug}>
                  {l.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Text inputs */}
        <div className="flex flex-col gap-2">
          <TitleField
            id={`cover-title-${bookId}`}
            label={hu.covers.titleLabel}
            value={title}
            onChange={(v) => setTitle(v)}
          />
          <TitleField
            id={`cover-author-${bookId}`}
            label={hu.covers.authorLabel}
            value={author}
            onChange={(v) => setAuthor(v)}
          />
          <TitleField
            id={`cover-subtitle-${bookId}`}
            label={hu.covers.subtitleLabel}
            value={subtitle}
            onChange={(v) => setSubtitle(v)}
          />
        </div>

        <Button
          type="button"
          variant="accent-outline"
          size={34}
          onClick={handleGenerate}
          disabled={generate.isPending || !artStyle || !layout}
          leadingIcon={
            generate.isPending ? (
              <Spinner size={14} />
            ) : (
              <Icon icon={ImageIcon} size={14} />
            )
          }
        >
          {generate.isPending ? hu.covers.generating : hu.covers.generate}
        </Button>
      </div>

      {/* Gallery */}
      {images.isError ? (
        <p role="status" className="m-0 text-[13px] text-danger-text">
          {hu.covers.loadError}
        </p>
      ) : images.isLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-text-muted">
          <Spinner size={14} />
          {hu.covers.loading}
        </div>
      ) : assets.length === 0 ? (
        <DashedTile
          size="image"
          aria-label={hu.covers.generateFirst}
          icon={<Icon icon={ImageIcon} size={22} />}
          label={hu.covers.empty}
          hint={hu.covers.emptyHint}
          onClick={handleGenerate}
          disabled={!artStyle || !layout || generate.isPending}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {assets.map((asset) => (
            <CoverTile
              key={asset.id}
              asset={asset}
              bookTitle={bookTitle}
              styleLabel={styleLabelFor(asset.style)}
              onRetry={() => runGenerate(asset.style ?? artStyle, layout)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// TitleField — a simple labelled text input helper (avoids duplicating label+input)
// ---------------------------------------------------------------------------

function TitleField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <FormInput
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CoverTile — mirrors ImageTile from image-panel.tsx; uses aspect-[2/3] for
// ebook cover proportions rather than square.
// ---------------------------------------------------------------------------

function CoverTile({
  asset,
  bookTitle,
  styleLabel,
  onRetry,
}: {
  asset: MediaAssetRead;
  bookTitle: string;
  styleLabel: string;
  onRetry: () => void;
}) {
  const setCanonical = useSetCanonical();
  const del = useDeleteImage();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const isGenerating = asset.status === "generating";
  const isFailed = asset.status === "failed";
  const isReady = !isGenerating && !isFailed;

  function handleSetCanonical() {
    setCanonical.mutate(
      { assetId: asset.id, entityType: asset.entity_type, entityId: asset.entity_id ?? "" },
      {
        onSuccess: () => toast.success(hu.covers.canonicalToast),
        onError: (error) => toast.error(`${hu.covers.title}: ${error.message}`),
      },
    );
  }

  function handleDelete() {
    del.mutate(
      { assetId: asset.id, entityType: asset.entity_type, entityId: asset.entity_id ?? "" },
      {
        onSuccess: () => toast.success(hu.covers.deletedToast),
        onError: (error) => toast.error(`${hu.covers.title}: ${error.message}`),
      },
    );
  }

  return (
    <div className="group relative flex flex-col gap-1.5">
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden rounded-[12px] border bg-surface-muted",
          asset.is_canonical
            ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-surface"
            : "border-border",
        )}
      >
        {asset.is_canonical ? (
          <span className="absolute left-1.5 top-1.5 z-[2] flex h-5 items-center gap-1 rounded-full bg-accent-strong px-2 text-[10px] font-semibold text-accent-fg">
            <Icon icon={Star} size={10} />
            {hu.covers.canonicalBadge}
          </span>
        ) : null}

        {isGenerating ? (
          <div className="relative h-full w-full">
            <Skeleton className="h-full w-full rounded-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center text-text-muted">
              <Spinner size={18} />
              <span className="px-2 text-[10px] font-medium leading-tight">
                {styleLabel
                  ? `${hu.covers.generatingCaption} · ${styleLabel}`
                  : hu.covers.generatingCaption}
              </span>
            </div>
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <span className="flex h-5 items-center rounded-full bg-danger-muted px-2 text-[11px] font-semibold text-danger-text">
              {hu.covers.failedChip}
            </span>
            <Button
              type="button"
              variant="ghost"
              size={28}
              onClick={onRetry}
              leadingIcon={<Icon icon={RotateCcw} size={12} />}
            >
              {hu.covers.retry}
            </Button>
          </div>
        ) : (
          <MediaThumb
            assetId={asset.id}
            alt={hu.covers.heroAlt(bookTitle)}
          />
        )}

        {/* Hover/focus overlay actions on a ready tile */}
        {isReady ? (
          <div className="absolute right-1.5 top-1.5 z-[2] flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {!asset.is_canonical ? (
              <Tooltip content={hu.covers.setCanonical}>
                <IconButton
                  variant="ai"
                  size={26}
                  onClick={handleSetCanonical}
                  disabled={setCanonical.isPending}
                  aria-label={hu.covers.setCanonical}
                  className="bg-surface/85 backdrop-blur-sm hover:bg-accent-muted"
                >
                  <Icon icon={Star} size={13} />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip content={hu.covers.delete}>
              <IconButton
                variant="danger"
                size={26}
                onClick={() => setConfirmOpen(true)}
                aria-label={hu.covers.delete}
                className="bg-surface/85 backdrop-blur-sm hover:bg-danger-muted"
              >
                <Icon icon={Trash2} size={13} />
              </IconButton>
            </Tooltip>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={hu.covers.deleteTitle}
        description={hu.covers.deleteDescription}
        onConfirm={handleDelete}
      />
    </div>
  );
}
