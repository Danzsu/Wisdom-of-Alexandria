/**
 * "Új sorozat" from the codex-entry scope picker (gap-fix #3).
 *
 * The scope picker (CodexDetail → Részletek → Hatókör) listed series read-only;
 * creating one required finding the sidebar's manage popover. It now offers an
 * "Új sorozat" affordance opening a small name modal → POST (project-scoped) →
 * the series list invalidates and the new series is selectable in the picker.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import {
  resetBookStore,
  resetCodexStore,
  resetSeriesStore,
} from "@/test/msw/handlers";
import {
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  FAROSZ_SERIES,
  makeSeries,
} from "@/test/msw/fixtures";
import { CodexDetail } from "@/components/codex/codex-detail";
import { hu } from "@/lib/i18n/hu";
import type { CodexEntryRead, SeriesRead } from "@/lib/api/types";

const base = `${API_BASE_URL}/api/v1`;

vi.mock("next/navigation", () => ({
  usePathname: () => `/konyv/${FAROSZ_BOOK.id}/codex`,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

const SZELENE: CodexEntryRead = {
  id: "codex-szelene",
  project_id: FAROSZ_PROJECT.id,
  series_id: null,
  title: "Szelene",
  entry_type: "character",
  content: "A Nagykönyvtár éjszakai írnoka.",
  aliases: [],
  role: null,
  ai_visible: true,
  tags: [],
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

function renderDetail() {
  return render(
    <Providers>
      <CodexDetail
        entry={SZELENE}
        projectId={FAROSZ_PROJECT.id}
        bookId={FAROSZ_BOOK.id}
        onDeleted={() => {}}
      />
    </Providers>,
  );
}

describe("Codex scope picker — create series", () => {
  beforeEach(() => {
    resetSeriesStore();
    resetCodexStore();
    resetBookStore();
  });

  it("creates a PROJECT-scoped series from the picker and makes it selectable", async () => {
    const user = userEvent.setup();
    // Local stateful override so we can capture the EXACT POST target + body
    // while keeping list → create → list consistent.
    const created: SeriesRead[] = [];
    const posts: Array<{ projectId: string; body: Record<string, unknown> }> =
      [];
    server.use(
      http.get(`${base}/projects/:projectId/series`, () =>
        HttpResponse.json([FAROSZ_SERIES, ...created]),
      ),
      http.post(
        `${base}/projects/:projectId/series`,
        async ({ params, request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          posts.push({ projectId: String(params.projectId), body });
          const series = makeSeries(String(params.projectId), {
            title: String(body.title),
          });
          created.push(series);
          return HttpResponse.json(series, { status: 201 });
        },
      ),
    );

    renderDetail();
    const scope = (await screen.findByLabelText(
      hu.codex.entryScopeLabel,
    )) as HTMLSelectElement;
    // The existing series loads first (proves the picker reads the real list).
    await waitFor(() =>
      expect(
        within(scope).queryByRole("option", { name: FAROSZ_SERIES.title }),
      ).toBeInTheDocument(),
    );

    // Open the modal from the scope picker.
    await user.click(
      screen.getByRole("button", { name: hu.codex.seriesNewLabel }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: hu.codex.seriesNewLabel,
    });

    await user.type(
      within(dialog).getByLabelText(hu.codex.seriesNameLabel),
      "Holdfény ciklus",
    );
    await user.click(
      within(dialog).getByRole("button", { name: hu.codex.seriesCreate }),
    );

    // The POST hit the PROJECT-scoped endpoint with exactly the typed title —
    // a wrong project id or a mangled payload fails here (mutation guard).
    await waitFor(() => expect(posts).toHaveLength(1));
    expect(posts[0].projectId).toBe(FAROSZ_PROJECT.id);
    expect(posts[0].body).toEqual({ title: "Holdfény ciklus" });

    // The modal closes and the NEW series becomes selectable in the picker.
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: hu.codex.seriesNewLabel }),
      ).not.toBeInTheDocument(),
    );
    await waitFor(() =>
      expect(
        within(scope).queryByRole("option", { name: "Holdfény ciklus" }),
      ).toBeInTheDocument(),
    );
  });

  it("does not POST an empty name (create disabled until a name is typed)", async () => {
    const user = userEvent.setup();
    let postCount = 0;
    server.use(
      http.post(`${base}/projects/:projectId/series`, () => {
        postCount += 1;
        return HttpResponse.json(
          makeSeries(FAROSZ_PROJECT.id, { title: "x" }),
          { status: 201 },
        );
      }),
    );

    renderDetail();
    await screen.findByLabelText(hu.codex.entryScopeLabel);
    await user.click(
      screen.getByRole("button", { name: hu.codex.seriesNewLabel }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: hu.codex.seriesNewLabel,
    });

    const createButton = within(dialog).getByRole("button", {
      name: hu.codex.seriesCreate,
    });
    expect(createButton).toBeDisabled();
    expect(postCount).toBe(0);
  });

  it("surfaces a create failure (never swallowed) and keeps the modal open", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${base}/projects/:projectId/series`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    renderDetail();
    await screen.findByLabelText(hu.codex.entryScopeLabel);
    await user.click(
      screen.getByRole("button", { name: hu.codex.seriesNewLabel }),
    );
    const dialog = await screen.findByRole("dialog", {
      name: hu.codex.seriesNewLabel,
    });
    await user.type(
      within(dialog).getByLabelText(hu.codex.seriesNameLabel),
      "Hibás sorozat",
    );
    await user.click(
      within(dialog).getByRole("button", { name: hu.codex.seriesCreate }),
    );

    // The error surfaces to the user (inline alert + toast both carry it).
    const errors = await screen.findAllByText(
      new RegExp(hu.codex.seriesCreateError),
    );
    expect(errors.length).toBeGreaterThanOrEqual(1);
    // …and the modal stays open so the input is not lost.
    expect(
      screen.getByRole("dialog", { name: hu.codex.seriesNewLabel }),
    ).toBeInTheDocument();
  });

  it("a11y: the open create-series modal has no violations", async () => {
    const user = userEvent.setup();
    renderDetail();
    await screen.findByLabelText(hu.codex.entryScopeLabel);
    await user.click(
      screen.getByRole("button", { name: hu.codex.seriesNewLabel }),
    );
    await screen.findByRole("dialog", { name: hu.codex.seriesNewLabel });
    // Portalled modal → scan the document.
    await expectNoA11yViolations(document);
  });
});
