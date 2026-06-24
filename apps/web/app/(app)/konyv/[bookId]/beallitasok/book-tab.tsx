"use client";

/**
 * "Könyv" tab content for the book settings page.
 *
 * Lets the writer edit the book's metadata: title, genre, and author (the
 * byline shown on generated covers and later in exports). Uses the same
 * `useResolvedBook` + `useUpdateBook` hooks as the Export screen so the
 * resolved-book cache is shared. Saves via PATCH; never overwrites on mount.
 */

import { useEffect, useId, useState } from "react";
import { useParams } from "next/navigation";
import { useResolvedBook } from "@/lib/api/export-hooks";
import { useUpdateBook } from "@/lib/api/hooks";
import { Button, FieldLabel, FormInput, toast } from "@/components/kit";
import { CoverPanel } from "@/components/book/cover-panel";
import { hu } from "@/lib/i18n/hu";

export function BookTab() {
  const params = useParams<{ bookId: string }>();
  const bookId = params?.bookId;

  const bookQuery = useResolvedBook(bookId);
  const updateBook = useUpdateBook();

  // Controlled form state — seeded from the resolved book, never undefined.
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [author, setAuthor] = useState("");

  // Seed form once the book resolves (or after a successful save).
  useEffect(() => {
    if (bookQuery.data) {
      setTitle(bookQuery.data.title ?? "");
      setGenre(bookQuery.data.genre ?? "");
      setAuthor(bookQuery.data.author ?? "");
    }
  }, [bookQuery.data]);

  const titleId = useId();
  const genreId = useId();
  const authorId = useId();

  function handleSave(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!bookQuery.data) return;
    updateBook.mutate(
      {
        projectId: bookQuery.data.project_id,
        bookId: bookQuery.data.id,
        patch: {
          title: title || undefined,
          genre: genre || null,
          author: author || null,
        },
      },
      {
        onSuccess: () => {
          toast.success(hu.books.saveSuccess);
        },
        onError: () => {
          toast.error(hu.books.saveError);
        },
      },
    );
  }

  if (bookQuery.isLoading) {
    return <p className="text-[14px] text-text-muted">{hu.books.loading}</p>;
  }

  if (bookQuery.isError) {
    return <p className="text-[14px] text-danger">{hu.books.loadError}</p>;
  }

  return (
    <>
      <h1 className="mb-1 font-display text-[26px] font-semibold text-text">
        {hu.books.settingsTitle}
      </h1>
      <p className="mb-8 text-[13px] text-text-muted">
        {hu.books.settingsSubtitle}
      </p>

      <form onSubmit={handleSave} className="flex flex-col gap-5">
        {/* Title */}
        <div>
          <FieldLabel htmlFor={titleId}>{hu.books.titleLabel}</FieldLabel>
          <FormInput
            id={titleId}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={hu.books.titlePlaceholder}
          />
        </div>

        {/* Genre */}
        <div>
          <FieldLabel htmlFor={genreId}>{hu.books.genreLabel}</FieldLabel>
          <FormInput
            id={genreId}
            value={genre}
            onChange={(e) => setGenre(e.target.value)}
            placeholder={hu.books.genrePlaceholder}
          />
        </div>

        {/* Author */}
        <div>
          <FieldLabel htmlFor={authorId}>{hu.books.authorLabel}</FieldLabel>
          <FormInput
            id={authorId}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder={hu.books.authorPlaceholder}
          />
        </div>

        <div className="pt-2">
          <Button type="submit" disabled={updateBook.isPending}>
            {updateBook.isPending ? hu.books.saving : hu.books.save}
          </Button>
        </div>
      </form>

      <hr className="my-8 border-border" />

      {bookQuery.data ? (
        <CoverPanel
          bookId={bookQuery.data.id}
          bookTitle={bookQuery.data.title}
          bookAuthor={bookQuery.data.author ?? null}
        />
      ) : null}
    </>
  );
}
