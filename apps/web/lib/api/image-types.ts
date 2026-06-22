/**
 * Frontend contract types + Zod schemas for the AI image-generation endpoints
 * (Phase 1). These mirror the backend Pydantic schemas (`apps/ai/app/schemas/
 * media_asset.py`) exactly so a contract drift surfaces as a thrown Zod error
 * rather than a silent shape mismatch (same discipline as `lib/api/ai-types.ts`).
 *
 * Source of truth:
 * - `apps/ai/app/schemas/media_asset.py` (MediaAssetRead / ImageStyleInfo)
 */
import { z } from "zod";
import type {
  Expect,
  ImageStyleInfo as GenImageStyleInfo,
  MatchesContract,
  MediaAssetRead as GenMediaAssetRead,
} from "@alexandria/shared";
import { idString } from "./schema-primitives";

/* ---------------------------------------------------------------------------
 * MediaAssetRead — mirrors media_asset.py (MediaAssetRead).
 *
 * The SAFE client view of a generated image: it deliberately omits
 * `file_path` / `thumb_path` (the client never sees a filesystem path and
 * builds the image URL from `id` via `GET /ai/media/{id}`). `status` stays a
 * tolerant `z.string()` (generating / ready / failed today) — an unknown status
 * still parses and the UI falls back gracefully rather than throwing.
 * ------------------------------------------------------------------------- */
export const mediaAssetReadSchema = z.object({
  id: idString,
  project_id: idString,
  entity_type: z.string(),
  entity_id: idString.nullable(),
  status: z.string(),
  mime: z.string(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  model_name: z.string().nullable(),
  style: z.string().nullable(),
  is_canonical: z.boolean(),
  created_at: z.string(),
});
export type MediaAssetRead = z.infer<typeof mediaAssetReadSchema>;

/* ---------------------------------------------------------------------------
 * ImageStyleInfo — mirrors media_asset.py (ImageStyleInfo). A selectable
 * image-prompt style preset for an entity type.
 * ------------------------------------------------------------------------- */
export const imageStyleInfoSchema = z.object({
  slug: z.string(),
  label: z.string(),
  entity_type: z.string(),
});
export type ImageStyleInfo = z.infer<typeof imageStyleInfoSchema>;

/* ---------------------------------------------------------------------------
 * FE↔BE contract ties. Each schema's inferred shape is bound to the
 * OpenAPI-generated backend type from `@alexandria/shared` (these come from the
 * `apps/ai` OpenAPI). A field add/remove/rename — or an incompatible type drift
 * — on either side fails `tsc`. Compile-time only; the Zod schemas above stay
 * the runtime validators. (Mirrors the Expect block in `ai-types.ts`.)
 * ------------------------------------------------------------------------- */
export type ImageContractTies = [
  Expect<
    MatchesContract<z.infer<typeof mediaAssetReadSchema>, GenMediaAssetRead>
  >,
  Expect<
    MatchesContract<z.infer<typeof imageStyleInfoSchema>, GenImageStyleInfo>
  >,
];
