"use client";

/**
 * Codex Image Lightbox — a full-screen preview of a Codex (character/location)
 * image. Opened by clicking a thumbnail in the {@link ImagePanel} gallery.
 *
 * A dark, blurred backdrop fills the viewport; the image is shown centered at
 * full size with the entry name as a caption beneath it, and a semi-transparent
 * close button sits top-right. When the entry has no image (no `assetId`) a
 * fallback icon + name is shown instead — never a broken `<img>`.
 *
 * Built on Radix `Dialog` so focus is trapped inside the overlay, Escape and a
 * backdrop click dismiss, and focus returns to the trigger on close — all for
 * free. The image binary is fetched WITH the JWT in the header (never in the
 * URL) and shown via an object URL, exactly like the gallery thumbnails.
 * Hungarian copy lives in `hu.codex` (the `lightbox*` keys).
 */
import { ImageIcon, X } from "lucide-react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Icon } from "@/components/kit/icon";
import { Spinner } from "@/components/kit/spinner";
import { useMediaObjectUrl } from "@/lib/api/image-hooks";
import { hu } from "@/lib/i18n/hu";

export interface CodexImageLightboxProps {
  /** Whether the lightbox is open. */
  open: boolean;
  /** Called when the lightbox should close (close button / Esc / backdrop). */
  onClose: () => void;
  /** The codex entry's display name (caption + accessible name). */
  name: string;
  /**
   * The media asset id to preview at full size. When omitted, the fallback
   * (icon + name) is shown instead of an image.
   */
  assetId?: string;
}

/**
 * The full-size image. Fetched (authenticated) via {@link useMediaObjectUrl}
 * and shown through an in-memory object URL, so a plain `<img>` is required
 * (next/image cannot carry the Authorization header) and the token never leaks
 * into a URL. Shows a spinner while loading, an error line on failure.
 */
function LightboxImage({ assetId, name }: { assetId: string; name: string }) {
  const { url, isLoading, isError } = useMediaObjectUrl(assetId);

  if (isError) {
    return (
      <p role="status" className="m-0 text-[14px] font-medium text-white/90">
        {hu.codex.lightboxLoadError}
      </p>
    );
  }
  if (isLoading || !url) {
    return (
      <span className="text-white/80">
        <Spinner size={28} />
      </span>
    );
  }
  return (
    // In-memory object URL (no next/image proxy possible); the authenticated
    // fetch already happened, so no token ever rides a URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="max-h-[80vh] max-w-full rounded-[14px] object-contain shadow-modal"
    />
  );
}

/** Full-screen, focus-trapped preview of a single codex image (or a fallback). */
export function CodexImageLightbox({
  open,
  onClose,
  name,
  assetId,
}: Readonly<CodexImageLightboxProps>) {
  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPrimitive.Portal>
        {/* The overlay carries the dark blur backdrop; the Content fills it and
            is the focus-trapped dialog. A click that reaches the Content (i.e.
            outside the image/close button) closes — matching the design's
            backdrop-dismiss. */}
        <DialogPrimitive.Overlay
          className="fixed inset-0 z-[95] bg-[color-mix(in_srgb,var(--background)_24%,rgba(0,0,0,.72))] backdrop-blur-[10px] [animation:woaFade_.2s_ease_both] motion-reduce:[animation:none]"
        />
        <DialogPrimitive.Content
          aria-label={hu.codex.lightboxLabel(name)}
          onClick={onClose}
          className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-5 p-10 focus:outline-none"
        >
          <DialogPrimitive.Title className="sr-only">
            {hu.codex.lightboxLabel(name)}
          </DialogPrimitive.Title>

          <DialogPrimitive.Close
            aria-label={hu.codex.lightboxClose}
            // Stop propagation so the click doesn't ALSO reach the backdrop
            // handler on Content (which would fire onClose a second time).
            onClick={(e) => e.stopPropagation()}
            className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border-none bg-[color-mix(in_srgb,var(--surface)_18%,transparent)] text-white transition-colors hover:bg-[color-mix(in_srgb,var(--surface)_32%,transparent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Icon icon={X} size={20} />
          </DialogPrimitive.Close>

          {/* Stop propagation so clicking the image/fallback itself does not
              dismiss — only the surrounding backdrop does. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col items-center gap-5"
          >
            {assetId ? (
              <LightboxImage assetId={assetId} name={name} />
            ) : (
              <span
                className="flex h-28 w-28 items-center justify-center rounded-[18px] bg-[color-mix(in_srgb,var(--surface)_16%,transparent)] text-white/70"
                title={hu.codex.lightboxNoImage}
              >
                <Icon icon={ImageIcon} size={44} />
              </span>
            )}
            <span className="font-display text-[24px] font-semibold text-white [text-shadow:0_1px_8px_rgba(0,0,0,.4)]">
              {name}
            </span>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
