import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { hu } from "@/lib/i18n/hu";
import { NewBookWizard } from "@/components/projects/new-book-wizard";

const base = `${API_BASE_URL}/api/v1`;

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

function renderWizard() {
  return renderWithProviders(
    <NewBookWizard open onOpenChange={() => {}} />,
  );
}

describe("NewBookWizard", () => {
  it("renders the gold header band with title, subtitle and labelled icon", () => {
    renderWizard();
    // Visible dialog title + new subtitle in the header band.
    expect(
      screen.getByRole("heading", { name: hu.wizard.dialogTitle }),
    ).toBeInTheDocument();
    expect(screen.getByText(hu.wizard.headerSubtitle)).toBeInTheDocument();
    // Decorative gold icon tile carries an accessible label.
    expect(
      screen.getByLabelText(hu.wizard.headerIconAria),
    ).toBeInTheDocument();
  });

  it("shows the recap card with a display title and metadata chips on the summary step", async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.type(
      screen.getByLabelText(hu.wizard.titleLabel),
      "Az alexandriai hajnal",
    );
    await user.click(screen.getByRole("button", { name: hu.wizard.next }));
    await user.click(screen.getByRole("button", { name: hu.wizard.next }));
    expect(await screen.findByText(hu.wizard.step3Eyebrow)).toBeInTheDocument();

    // The recap shows the title prominently and the default metadata as chips.
    expect(screen.getByText("Az alexandriai hajnal")).toBeInTheDocument();
    expect(screen.getByText(hu.wizard.povThirdLimited)).toBeInTheDocument();
    expect(screen.getByText(hu.wizard.length80)).toBeInTheDocument();
    expect(screen.getByText(hu.wizard.audienceAdult)).toBeInTheDocument();
    // The "not yet persisted" note is still surfaced.
    expect(screen.getByText(hu.wizard.summaryNote)).toBeInTheDocument();
  });

  it("blocks advancing past step 1 without a title", async () => {
    const user = userEvent.setup();
    renderWizard();
    // Step 1 is shown.
    expect(screen.getByText(hu.wizard.step1Eyebrow)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: hu.wizard.next }));

    // Validation message appears and we stay on step 1.
    expect(await screen.findByText(hu.wizard.titleRequired)).toBeInTheDocument();
    expect(screen.getByText(hu.wizard.step1Eyebrow)).toBeInTheDocument();
    expect(screen.queryByText(hu.wizard.step2Eyebrow)).not.toBeInTheDocument();
  });

  it("walks all three steps and submits, navigating + toasting on success", async () => {
    const user = userEvent.setup();
    let postedProject = false;
    let postedBook = false;
    server.use(
      http.post(`${base}/projects`, async ({ request }) => {
        postedProject = true;
        const body = (await request.json()) as { title: string };
        return HttpResponse.json(
          {
            id: "33333333-3333-3333-3333-333333333333",
            title: body.title,
            description: null,
            language: "hu",
            created_at: "2026-06-14T15:00:00Z",
            updated_at: "2026-06-14T15:00:00Z",
            // Feature #1: the backend returns zero aggregates on create.
            book_count: 0,
            word_count: 0,
            scene_count: 0,
          },
          { status: 201 },
        );
      }),
      http.post(`${base}/projects/:pid/books`, async ({ params, request }) => {
        postedBook = true;
        const body = (await request.json()) as { title: string };
        return HttpResponse.json(
          {
            id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
            project_id: String(params.pid),
            series_id: null,
            title: body.title,
            description: null,
            synopsis: null,
            genre: "történelmi fantasy",
            language: "hu",
            word_count_target: 80000,
            order_index: 0,
            author: null,
            created_at: "2026-06-14T15:00:00Z",
            updated_at: "2026-06-14T15:00:00Z",
          },
          { status: 201 },
        );
      }),
    );

    renderWizard();

    await user.type(
      screen.getByLabelText(hu.wizard.titleLabel),
      "Az alexandriai hajnal",
    );

    // Step 1 → 2
    await user.click(screen.getByRole("button", { name: hu.wizard.next }));
    expect(await screen.findByText(hu.wizard.step2Eyebrow)).toBeInTheDocument();

    // Step 2 → 3
    await user.click(screen.getByRole("button", { name: hu.wizard.next }));
    expect(await screen.findByText(hu.wizard.step3Eyebrow)).toBeInTheDocument();

    // Summary shows the entered title.
    expect(screen.getByText("Az alexandriai hajnal")).toBeInTheDocument();

    // Submit.
    await user.click(screen.getByRole("button", { name: hu.wizard.create }));

    await waitFor(() => expect(postedBook).toBe(true));
    expect(postedProject).toBe(true);
    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith(
        "/konyv/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/terv",
      ),
    );
  });

  it("shows an inline error and does NOT navigate when the API fails", async () => {
    const user = userEvent.setup();
    pushMock.mockClear();
    server.use(
      http.post(`${base}/projects`, () =>
        HttpResponse.json({ detail: "hiba történt" }, { status: 500 }),
      ),
    );

    renderWizard();
    await user.type(
      screen.getByLabelText(hu.wizard.titleLabel),
      "Bukásra ítélt cím",
    );
    await user.click(screen.getByRole("button", { name: hu.wizard.next }));
    await user.click(screen.getByRole("button", { name: hu.wizard.next }));
    await user.click(screen.getByRole("button", { name: hu.wizard.create }));

    expect(await screen.findByText(/hiba történt/)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
