/**
 * Typed endpoint functions for the Chapters resource.
 *
 * Chapters are nested under a book (`apps/api/app/api/v1/chapters.py`, prefix
 * `/books/{book_id}/chapters` under `/api/v1`):
 *   GET    /books/{bid}/chapters          → ChapterRead[]
 *   GET    /books/{bid}/chapters/{cid}    → ChapterRead
 *
 * Responses are validated with Zod before reaching the UI, so a contract drift
 * surfaces as a thrown error rather than a silent shape mismatch.
 */
import { apiFetch } from "./client";
import {
  chapterListSchema,
  chapterReadSchema,
  type ChapterRead,
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
