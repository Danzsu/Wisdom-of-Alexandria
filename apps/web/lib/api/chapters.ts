/**
 * Typed endpoint functions for the Chapters resource.
 *
 * Chapters are nested under a book (`apps/api/app/api/v1/chapters.py`, prefix
 * `/books/{book_id}/chapters` under `/api/v1`):
 *   GET    /books/{bid}/chapters          → ChapterRead[]
 *   POST   /books/{bid}/chapters          → ChapterRead (201)
 *   GET    /books/{bid}/chapters/{cid}    → ChapterRead
 *   PATCH  /books/{bid}/chapters/{cid}    → ChapterRead
 *   DELETE /books/{bid}/chapters/{cid}    → 204
 *   POST   /books/{bid}/chapters/reorder  → ChapterRead[] (body: { order })
 *
 * Responses are validated with Zod before reaching the UI, so a contract drift
 * surfaces as a thrown error rather than a silent shape mismatch.
 */
import { apiFetch } from "./client";
import {
  chapterCreateSchema,
  chapterListSchema,
  chapterReadSchema,
  chapterReorderSchema,
  chapterUpdateSchema,
  type ChapterCreate,
  type ChapterRead,
  type ChapterReorder,
  type ChapterUpdate,
} from "./types";

/** List the chapters belonging to a book (backend orders by `order_index`). */
export async function listChapters(bookId: string): Promise<ChapterRead[]> {
  const data = await apiFetch<unknown>(`/books/${bookId}/chapters`);
  return chapterListSchema.parse(data);
}

/** Fetch a single chapter within a book. */
export async function getChapter(
  bookId: string,
  chapterId: string,
): Promise<ChapterRead> {
  const data = await apiFetch<unknown>(
    `/books/${bookId}/chapters/${chapterId}`,
  );
  return chapterReadSchema.parse(data);
}

/** Create a chapter under a book. The payload is validated against the contract. */
export async function createChapter(
  bookId: string,
  input: ChapterCreate,
): Promise<ChapterRead> {
  const body = chapterCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/books/${bookId}/chapters`, {
    method: "POST",
    body,
  });
  return chapterReadSchema.parse(data);
}

/** Patch a chapter (title / summary / status / order_index). */
export async function updateChapter(
  bookId: string,
  chapterId: string,
  input: ChapterUpdate,
): Promise<ChapterRead> {
  const body = chapterUpdateSchema.parse(input);
  const data = await apiFetch<unknown>(
    `/books/${bookId}/chapters/${chapterId}`,
    { method: "PATCH", body },
  );
  return chapterReadSchema.parse(data);
}

/** Delete a chapter (cascades to its scenes server-side). */
export async function deleteChapter(
  bookId: string,
  chapterId: string,
): Promise<void> {
  await apiFetch<unknown>(`/books/${bookId}/chapters/${chapterId}`, {
    method: "DELETE",
  });
}

/**
 * Reorder a book's chapters. `order` is the full list of chapter ids in their
 * new sequence; the backend assigns `order_index` by position and returns the
 * re-sorted chapter list.
 */
export async function reorderChapters(
  bookId: string,
  order: string[],
): Promise<ChapterRead[]> {
  const body: ChapterReorder = chapterReorderSchema.parse({ order });
  const data = await apiFetch<unknown>(`/books/${bookId}/chapters/reorder`, {
    method: "POST",
    body,
  });
  return chapterListSchema.parse(data);
}
