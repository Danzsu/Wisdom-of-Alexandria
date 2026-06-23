/** Typed endpoint functions for the cover-generation endpoints (Phase 2). On the
 *  AI service base. A cover is a MediaAsset(entity_type="cover"); list/canonical/
 *  delete/media reuse `images.ts`. */
import { z } from "zod";
import { AI_BASE_URL, apiFetch } from "./client";
import {
  coverLayoutInfoSchema,
  imageStyleInfoSchema,
  mediaAssetReadSchema,
  type CoverLayoutInfo,
  type ImageStyleInfo,
  type MediaAssetRead,
} from "./image-types";

export interface GenerateCoverInput {
  bookId: string;
  artStyle: string;
  layout: string;
  title?: string | null;
  author?: string | null;
  subtitle?: string | null;
  model?: string | null;
}

export async function generateCover(input: GenerateCoverInput): Promise<MediaAssetRead> {
  const data = await apiFetch<unknown>("/ai/covers", {
    method: "POST",
    body: {
      book_id: input.bookId,
      art_style: input.artStyle,
      layout: input.layout,
      title: input.title ?? null,
      author: input.author ?? null,
      subtitle: input.subtitle ?? null,
      model: input.model ?? null,
    },
    baseUrl: AI_BASE_URL,
  });
  return mediaAssetReadSchema.parse(data);
}

export async function listCoverStyles(): Promise<ImageStyleInfo[]> {
  const data = await apiFetch<unknown>("/ai/covers/styles", { baseUrl: AI_BASE_URL });
  return z.array(imageStyleInfoSchema).parse(data);
}

export async function listCoverLayouts(): Promise<CoverLayoutInfo[]> {
  const data = await apiFetch<unknown>("/ai/covers/layouts", { baseUrl: AI_BASE_URL });
  return z.array(coverLayoutInfoSchema).parse(data);
}
