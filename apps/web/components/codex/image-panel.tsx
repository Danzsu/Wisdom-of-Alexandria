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
import { useEffect, useState } from "react";
import { ImageIcon, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/kit/button";
import { Spinner } from "@/components/kit/spinner";
import { Icon } from "@/components/kit/icon";
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

  function handleGenerate() {
    if (!style) return;
    generate.mutate(
      {
        entityType: entry.entry_type,
        entityId: entry.id,
        projectId: entry.project_id,
        style,
      },
      {
        onError: (error) =>
          toast.error(`${hu.images.generateError}: ${error.message}`),
      },
    );
  }

  const assets = images.data ?? [];

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
        <p className="m-0 text-[13px] text-text-muted">{hu.images.empty}</p>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
          {assets.map((asset) => (
            <ImageTile key={asset.id} asset={asset} entryTitle={entry.title} />
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
}: {
  asset: MediaAssetRead;
  entryTitle: string;
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
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-square overflow-hidden rounded-[12px] border border-border bg-surface-muted">
        {asset.is_canonical ? (
          <span className="absolute left-1.5 top-1.5 z-[1] flex h-5 items-center gap-1 rounded-full bg-accent-strong px-2 text-[10px] font-semibold text-accent-fg">
            <Icon icon={Star} size={10} />
            {hu.images.canonicalBadge}
          </span>
        ) : null}

        {isGenerating ? (
          <div className="flex h-full w-full items-center justify-center text-text-muted">
            <Spinner size={20} />
          </div>
        ) : isFailed ? (
          <div className="flex h-full w-full items-center justify-center">
            <span className="flex h-5 items-center rounded-full bg-danger-muted px-2 text-[11px] font-semibold text-danger-text">
              {hu.images.failedChip}
            </span>
          </div>
        ) : (
          <MediaThumb
            assetId={asset.id}
            alt={hu.images.thumbAlt(entryTitle, asset.style ?? "")}
          />
        )}
      </div>

      {isReady ? (
        <div className="flex items-center gap-1.5">
          {!asset.is_canonical ? (
            <button
              type="button"
              onClick={handleSetCanonical}
              disabled={setCanonical.isPending}
              aria-label={hu.images.setCanonical}
              title={hu.images.setCanonical}
              className="flex h-7 flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-surface px-2 text-[11px] text-text-soft hover:border-accent hover:bg-accent-muted hover:text-accent-text disabled:opacity-50"
            >
              <Icon icon={Star} size={12} />
              {hu.images.setCanonical}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            aria-label={hu.images.delete}
            title={hu.images.delete}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg border border-border bg-surface text-text-muted hover:border-danger hover:bg-danger-muted hover:text-danger-text"
          >
            <Icon icon={Trash2} size={12} />
          </button>
        </div>
      ) : null}

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
