import { describe, it, expect, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { resetImageStore } from "@/test/msw/handlers";
import { CoverPanel } from "@/components/book/cover-panel";
import { hu } from "@/lib/i18n/hu";

const aiBase = `${AI_BASE_URL}/api/v1`;
const BOOK = { id: "book-1", title: "Fárosz", author: "Rácz D." };

describe("CoverPanel", () => {
  beforeEach(() => resetImageStore());

  it("renders style + layout pickers and posts a cover generation", async () => {
    const user = userEvent.setup();
    const posted: Record<string, unknown>[] = [];
    server.use(
      http.post(`${aiBase}/ai/covers`, async ({ request }) => {
        posted.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json(
          { id: "c1", project_id: "p", entity_type: "cover", entity_id: "book-1",
            status: "generating", mime: "image/png", width: null, height: null,
            model_name: "x", style: "cover_fantasy", is_canonical: false,
            created_at: "2026-06-22T00:00:00Z" }, { status: 202 });
      }),
    );
    renderWithProviders(<CoverPanel bookId={BOOK.id} bookTitle={BOOK.title} bookAuthor={BOOK.author} />);
    // Radix Select triggers expose role="combobox" + aria-label (not a native
    // control, so findByLabelText doesn't apply — query by combobox role instead).
    await screen.findByRole("combobox", { name: hu.covers.artStyleLabel });
    await screen.findByRole("combobox", { name: hu.covers.layoutLabel });
    await user.click(await screen.findByRole("button", { name: hu.covers.generate }));
    await waitFor(() => expect(posted.length).toBe(1));
    expect(posted[0]).toMatchObject({
      book_id: "book-1",
      art_style: expect.any(String),
      layout: expect.any(String),
      // title/author are prefilled from the book props and must be sent.
      title: BOOK.title,
      author: BOOK.author,
    });
  });

  it("shows the empty state when no covers exist", async () => {
    renderWithProviders(<CoverPanel bookId={BOOK.id} bookTitle={BOOK.title} bookAuthor={BOOK.author} />);
    expect(await screen.findByText(hu.covers.empty)).toBeInTheDocument();
  });
});
