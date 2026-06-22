"use client";

/**
 * TanStack Query hooks for the AI image-generation flow (Phase 1): list an
 * entity's images (polling while any is still generating), enqueue a new
 * generation, set canonical, delete, and list the static style presets.
 *
 * Errors propagate via Query's `error` / `isError` (never swallowed). Business
 * logic lives here + in `lib/api/images.ts`; components only render state and
 * fire callbacks.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from "@tanstack/react-query";
import {
  deleteImage,
  generateImage,
  listImageStyles,
  listImages,
  setCanonical,
  type GenerateImageInput,
} from "./images";
import type { ImageStyleInfo, MediaAssetRead } from "./image-types";

/** Query keys for the image resources. */
export const imageKeys = {
  entity: (entityType: string, entityId: string) =>
    ["images", entityType, entityId] as const,
};

/** How often the gallery re-polls (ms) while an image is still generating. */
const IMAGE_POLL_INTERVAL_MS = 2_000;

/**
 * List an entity's generated images. Disabled until both `entityType` and
 * `entityId` are known. While ANY returned asset is still `generating`, the
 * query polls every ~2s so a finished image flips to ready on its own; once
 * none are generating, polling stops (`false`). (Mirrors the terminal-check
 * style of `useRebuildIndex`.)
 */
export function useEntityImages(
  entityType: string | undefined,
  entityId: string | undefined,
): UseQueryResult<MediaAssetRead[], Error> {
  return useQuery({
    queryKey: imageKeys.entity(entityType ?? "__none__", entityId ?? "__none__"),
    queryFn: () =>
      listImages({
        entityType: entityType as string,
        entityId: entityId as string,
      }),
    enabled: Boolean(entityType) && Boolean(entityId),
    // Poll while something is generating, else stop. A background tab pauses.
    refetchInterval: (query) => {
      const assets = query.state.data;
      const anyGenerating = assets?.some((a) => a.status === "generating");
      return anyGenerating ? IMAGE_POLL_INTERVAL_MS : false;
    },
    refetchIntervalInBackground: false,
  });
}

/**
 * Enqueue an image generation. On success the entity image list is invalidated
 * so the gallery refetches — picking up the new `generating` asset, which in
 * turn starts the poll in {@link useEntityImages}.
 */
export function useGenerateImage(): UseMutationResult<
  MediaAssetRead,
  Error,
  GenerateImageInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateImageInput) => generateImage(input),
    onSuccess: (asset) => {
      void queryClient.invalidateQueries({
        queryKey: imageKeys.entity(asset.entity_type, asset.entity_id ?? ""),
      });
    },
  });
}

/** Input for the canonical/delete mutations (the asset + its owning entity). */
export interface ImageEntityInput {
  assetId: string;
  entityType: string;
  entityId: string;
}

/** Mark an image canonical, then invalidate the entity's image list. */
export function useSetCanonical(): UseMutationResult<
  MediaAssetRead,
  Error,
  ImageEntityInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId }: ImageEntityInput) => setCanonical(assetId),
    onSuccess: (_data, { entityType, entityId }) => {
      void queryClient.invalidateQueries({
        queryKey: imageKeys.entity(entityType, entityId),
      });
    },
  });
}

/** Delete an image, then invalidate the entity's image list. */
export function useDeleteImage(): UseMutationResult<
  void,
  Error,
  ImageEntityInput
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId }: ImageEntityInput) => deleteImage(assetId),
    onSuccess: (_data, { entityType, entityId }) => {
      void queryClient.invalidateQueries({
        queryKey: imageKeys.entity(entityType, entityId),
      });
    },
  });
}

/**
 * List the image-prompt style presets for an entity type. Styles are STATIC
 * (config-driven, never hardcoded in the UI), so the result is kept fresh for
 * the whole session.
 */
export function useImageStyles(
  entityType: string | undefined,
): UseQueryResult<ImageStyleInfo[], Error> {
  return useQuery({
    queryKey: ["image-styles", entityType ?? "__none__"],
    queryFn: () => listImageStyles(entityType as string),
    enabled: Boolean(entityType),
    staleTime: 5 * 60_000,
  });
}
