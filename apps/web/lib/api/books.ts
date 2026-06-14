/**
 * Typed endpoint functions for the Books resource.
 *
 * Books are nested under a project (`apps/api/app/api/v1/books.py`, prefix
 * `/projects/{project_id}/books` under `/api/v1`):
 *   GET    /projects/{pid}/books          → BookRead[]
 *   GET    /projects/{pid}/books/{bid}    → BookRead
 *   POST   /projects/{pid}/books          → BookRead (201)
 *
 * The `project_id` lives in the path; `BookCreate` carries only the book fields.
 */
import { apiFetch } from "./client";
import {
  bookCreateSchema,
  bookListSchema,
  bookReadSchema,
  type BookCreate,
  type BookRead,
} from "./types";

/** List the books belonging to a project. */
export async function listBooks(projectId: string): Promise<BookRead[]> {
  const data = await apiFetch<unknown>(`/projects/${projectId}/books`);
  return bookListSchema.parse(data);
}

/** Fetch a single book within a project. */
export async function getBook(
  projectId: string,
  bookId: string,
): Promise<BookRead> {
  const data = await apiFetch<unknown>(
    `/projects/${projectId}/books/${bookId}`,
  );
  return bookReadSchema.parse(data);
}

/** Create a book under a project. The payload is validated first. */
export async function createBook(
  projectId: string,
  input: BookCreate,
): Promise<BookRead> {
  const body = bookCreateSchema.parse(input);
  const data = await apiFetch<unknown>(`/projects/${projectId}/books`, {
    method: "POST",
    body,
  });
  return bookReadSchema.parse(data);
}
