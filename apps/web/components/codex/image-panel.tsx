"use client";

/**
 * Képek — the AI image panel inside a Codex character/location detail (Phase 1).
 *
 * Picks an image-prompt style (config-driven, never hardcoded), enqueues a
 * generation, and renders the entity's images as a thumbnail grid. A generating
 * asset shows a spinner tile (the list auto-polls and flips it to ready); the
 * canonical asset gets a badge; ready assets offer set-canonical + delete; a
 * failed asset shows an error chip. All data flows through the image hooks —
 * errors surface via Query state + toast, never swallowed. Hungarian copy lives
 * in `hu.images`.
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
import {
  useDeleteImage,
  useEntityImages,
  useGenerateImage,
  useImageStyles,
  useMediaObjectUrl,
  useSetCanonical,
} from "@/lib/api/image-hooks";
import type { MediaAssetRead } from "@/lib/api/image-types";
import type { CodexEntryRead } from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

/**
 * Renders a ready image's thumbnail. The binary is fetched WITH the JWT in the
 * Authorization header (never in the URL) and shown via an object URL, so a
 * plain <img> is required (next/image can't carry the header) — and the token
 * never leaks into a URL/log. Shows a spinner while loading, an error chip on
 * failure.
 */
function MediaThumb({ assetId, alt }: { assetId: string; alt: string }) {
  const { url, isLoading, isError } = useMediaObjectUrl(assetId, {
    thumb: true,
  });

  if (isError) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <span className="flex h-5 items-center rounded-full bg-danger-muted px-2 text-[11px] font-semibold text-danger-text">
          {hu.images.failedChip}
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
    // The src is an in-memory object URL (no next/image proxy possible); the
    // authenticated fetch already happened, so the token never rides a URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={alt} className="h-full w-full object-cover" />
  );
}

export interface ImagePanelProps {
  entry: CodexEntryRead;
}

/**
 * The image panel for a single Codex entry. Mounted only for character/location
 * entries (the parent gates on `entry_type`).
 */
export function ImagePanel({ entry }: ImagePanelProps) {
  const styles = useImageStyles(entry.entry_type);
  const images = useEntityImages(entry.entry_type, entry.id);
  const generate = useGenerateImage();

  const [style, setStyle] = useState("");
  // Default the picker to the first style once they load (and whenever the set
  // changes), unless the user already chose a still-valid one.
  useEffect(() => {
    const options = styles.data ?? [];
    if (options.length === 0) return;
    setStyle((current) =>
      current && options.some((s) => s.slug === current)
        ? current
        : options[0].slug,
    );
  }, [styles.data]);

  // Generate (or re-generate) with an explicit style slug. Shared by the main
  // button and a failed tile's Retry action.
  const runGenerate = useCallback(
    (styleSlug: string) => {
      if (!styleSlug) return;
      generate.mutate(
        {
          entityType: entry.entry_type,
          entityId: entry.id,
          projectId: entry.project_id,
          style: styleSlug,
        },
        {
          onError: (error) =>
            toast.error(`${hu.images.generateError}: ${error.message}`),
        },
      );
    },
    [generate, entry.entry_type, entry.id, entry.project_id],
  );

  function handleGenerate() {
    runGenerate(style);
  }

  /** Human label for a style slug (falls back to the slug). */
  function styleLabelFor(slug: string | null): string {
    if (!slug) return "";
    return (styles.data ?? []).find((s) => s.slug === slug)?.label ?? slug;
  }

  // Canonical image first (stable sort keeps the backend's newest-first order
  // within each group), so the "official" image leads the gallery.
  const assets = [...(images.data ?? [])].sort(
    (a, b) => Number(b.is_canonical) - Number(a.is_canonical),
  );

  return (
    <section className="flex flex-col gap-3">
      <SectionEyebrow as="h3">{hu.images.title}</SectionEyebrow>

      {/* Generate controls */}
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="codex-image-style"
            className="text-[11px] font-semibold uppercase tracking-[0.06em] text-text-muted"
          >
            {hu.images.styleLabel}
          </label>
          <select
            id="codex-image-style"
            aria-label={hu.images.styleLabel}
            value={style}
            onChange={(e) => setStyle(e.target.value)}
            disabled={(styles.data ?? []).length === 0}
            className="box-border h-9 w-full min-w-[200px] rounded-[10px] border border-border bg-surface px-3 text-[13px] text-text outline-none focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]"
          >
            {(styles.data ?? []).map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          variant="accent-outline"
          size={34}
          onClick={handleGenerate}
          disabled={generate.isPending || !style}
          leadingIcon={
            generate.isPending ? (
              <Spinner size={14} />
            ) : (
              <Icon icon={ImageIcon} size={14} />
            )
          }
        >
          {generate.isPending ? hu.images.generating : hu.images.generate}
        </Button>
      </div>

      {styles.isError ? (
        <p role="status" className="m-0 text-[12px] text-danger-text">
          {hu.images.styleLoadError}
        </p>
      ) : null}

      {/* Gallery */}
      {images.isError ? (
        <p role="status" className="m-0 text-[13px] text-danger-text">
          {hu.images.loadError}
        </p>
      ) : images.isLoading ? (
        <div className="flex items-center gap-2 text-[13px] text-text-muted">
          <Spinner size={14} />
          {hu.images.loading}
        </div>
      ) : assets.length === 0 ? (
        <DashedTile
          size="image"
          aria-label={hu.images.generateFirst}
          icon={<Icon icon={ImageIcon} size={22} />}
          label={hu.images.empty}
          hint={hu.images.emptyHint}
          onClick={handleGenerate}
          disabled={!style || generate.isPending}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {assets.map((asset) => (
            <ImageTile
              key={asset.id}
              asset={asset}
              entryTitle={entry.title}
              styleLabel={styleLabelFor(asset.style)}
              onRetry={() => runGenerate(asset.style ?? "")}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** A single gallery tile: thumbnail (or generating/failed placeholder) + actions. */
function ImageTile({
  asset,
  entryTitle,
  styleLabel,
  onRetry,
}: {
  asset: MediaAssetRead;
  entryTitle: string;
  /** Human label of the asset's style (for the generating caption / alt). */
  styleLabel: string;
  /** Re-run generation with this asset's style (failed-tile Retry). */
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
      {
        assetId: asset.id,
        entityType: asset.entity_type,
        entityId: asset.entity_id ?? "",
      },
      {
        onSuccess: () => toast.success(hu.images.canonicalToast),
        onError: (error) => toast.error(`${hu.images.title}: ${error.message}`),
      },
    );
  }

  function handleDelete() {
    del.mutate(
      {
        assetId: asset.id,
        entityType: asset.entity_type,
        entityId: asset.entity_id ?? "",
      },
      {
        onSuccess: () => toast.success(hu.images.deletedToast),
        onError: (error) => toast.error(`${hu.images.title}: ${error.message}`),
      },
    );
  }

  return (
    <div className="group relative flex flex-col gap-1.5">
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-[12px] border bg-surface-muted",
          // The canonical image is emphasised with an accent ring.
          asset.is_canonical
            ? "border-accent ring-2 ring-accent ring-offset-1 ring-offset-surface"
            : "border-border",
        )}
      >
        {asset.is_canonical ? (
          <span className="absolute left-1.5 top-1.5 z-[2] flex h-5 items-center gap-1 rounded-full bg-accent-strong px-2 text-[10px] font-semibold text-accent-fg">
            <Icon icon={Star} size={10} />
            {hu.images.canonicalBadge}
          </span>
        ) : null}

        {isGenerating ? (
          // Shimmer placeholder + caption so the tile reads as "working", not stuck.
          <div className="relative h-full w-full">
            <Skeleton className="h-full w-full rounded-none" />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-center text-text-muted">
              <Spinner size={18} />
              <span className="px-2 text-[10px] font-medium leading-tight">
                {styleLabel
                  ? `${hu.images.generatingCaption} · ${styleLabel}`
                  : hu.images.generatingCaption}
              </span>
            </div>
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2">
            <span className="flex h-5 items-center rounded-full bg-danger-muted px-2 text-[11px] font-semibold text-danger-text">
              {hu.images.failedChip}
            </span>
            <Button
              type="button"
              variant="ghost"
              size={28}
              onClick={onRetry}
              leadingIcon={<Icon icon={RotateCcw} size={12} />}
            >
              {hu.images.retry}
            </Button>
          </div>
        ) : (
          <MediaThumb
            assetId={asset.id}
            alt={hu.images.thumbAlt(entryTitle, styleLabel || (asset.style ?? ""))}
          />
        )}

        {/* Hover/focus overlay actions on a ready tile. Kept in the DOM (opacity
            toggle) so they stay focusable + reachable by assistive tech. */}
        {isReady ? (
          <div className="absolute right-1.5 top-1.5 z-[2] flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {!asset.is_canonical ? (
              <Tooltip content={hu.images.setCanonical}>
                <IconButton
                  variant="ai"
                  size={26}
                  onClick={handleSetCanonical}
                  disabled={setCanonical.isPending}
                  aria-label={hu.images.setCanonical}
                  className="bg-surface/85 backdrop-blur-sm hover:bg-accent-muted"
                >
                  <Icon icon={Star} size={13} />
                </IconButton>
              </Tooltip>
            ) : null}
            <Tooltip content={hu.images.delete}>
              <IconButton
                variant="danger"
                size={26}
                onClick={() => setConfirmOpen(true)}
                aria-label={hu.images.delete}
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
        title={hu.images.deleteTitle}
        description={hu.images.deleteDescription}
        onConfirm={handleDelete}
      />
    </div>
  );
}
