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
import { listProjects } from "./projects";
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

/**
 * Resolve a `BookRead` from a bare `bookId`.
 *
 * Books are nested under a project and there is no top-level `GET /books/{id}`,
 * but several routes (the Export screen) only carry `bookId`. We list projects
 * and, for each, its books, returning the one whose id matches. Acceptable for
 * the single-user MVP corpus; callers cache it via the hook layer. Throws (never
 * returns a wrong/empty book) when no owning project holds the id.
 */
export async function resolveBookById(bookId: string): Promise<BookRead> {
  const projects = await listProjects();
  for (const project of projects) {
    const books = await listBooks(project.id);
    const match = books.find((b) => b.id === bookId);
    if (match) return match;
  }
  throw new Error(`Nem található könyv ezzel az azonosítóval: ${bookId}`);
}
