/**
 * Series scope + management UX (Feature #3c).
 *
 *  - the Codex scope-toggle switches the ACTUAL server query (Sorozat scope hits
 *    `?series_id=` and shows project-global + that series; Projekt shows all),
 *  - a book with NO series shows the honest Sorozat note (not a fake/empty),
 *  - series management (create) + book→series assignment works, and a
 *    cross-project assignment surfaces the backend's 400,
 *  - the codex-entry scope picker sends `series_id`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  resetBookStore,
  resetCodexStore,
  resetSeriesStore,
} from "@/test/msw/handlers";
import {
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  FAROSZ_SERIES,
} from "@/test/msw/fixtures";
import { CodexSidebar } from "@/components/shell/codex-sidebar";
import { CodexDetail } from "@/components/codex/codex-detail";
import type { CodexEntryRead } from "@/lib/api/types";

const base = `${API_BASE_URL}/api/v1`;
const replaceSpy = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => `/konyv/${FAROSZ_BOOK.id}/codex`,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ replace: replaceSpy, push: vi.fn() }),
}));

function renderSidebar() {
  return render(
    <Providers>
      <CodexSidebar />
    </Providers>,
  );
}

describe("Codex series scope + management", () => {
  beforeEach(() => {
    resetCodexStore();
    resetSeriesStore();
    resetBookStore();
    replaceSpy.mockClear();
  });

  it("Projekt scope lists every entry; Sorozat scope queries ?series_id= and shows global + series", async () => {
    const user = userEvent.setup();
    const codexUrls: string[] = [];
    server.use(
      http.get(`${base}/projects/:projectId/codex`, ({ params, request }) => {
        codexUrls.push(request.url);
        const seriesId = new URL(request.url).searchParams.get("series_id");
        const projectId = String(params.projectId);
        const all = [
          {
            id: "codex-szelene",
            project_id: projectId,
            series_id: null,
            title: "Szelene",
            entry_type: "character",
            content: null,
            aliases: [],
            role: null,
            ai_visible: true,
            tags: [],
            created_at: "2026-06-14T14:32:00Z",
            updated_at: "2026-06-14T14:32:00Z",
          },
          {
            id: "codex-nagykonyvtar",
            project_id: projectId,
            series_id: FAROSZ_SERIES.id,
            title: "Nagykönyvtár",
            entry_type: "location",
            content: null,
            aliases: [],
            role: null,
            ai_visible: true,
            tags: [],
            created_at: "2026-06-14T14:32:00Z",
            updated_at: "2026-06-14T14:32:00Z",
          },
        ];
        const entries =
          seriesId === null
            ? all
            : all.filter((e) => e.series_id === null || e.series_id === seriesId);
        return HttpResponse.json(entries);
      }),
    );

    renderSidebar();
    // Project scope (default): both entries.
    expect(await screen.findByText("Szelene")).toBeInTheDocument();
    expect(screen.getByText("Nagykönyvtár")).toBeInTheDocument();

    // Switch to the series scope.
    await user.click(screen.getByRole("button", { name: "Sorozat" }));

    // The series scope issued a query carrying ?series_id=<the book's series>.
    await waitFor(() =>
      expect(
        codexUrls.some((u) => u.includes(`series_id=${FAROSZ_SERIES.id}`)),
      ).toBe(true),
    );
    // Still shows project-global + the series entry (both belong to this series'
    // scope here).
    expect(screen.getByText("Szelene")).toBeInTheDocument();
    expect(screen.getByText("Nagykönyvtár")).toBeInTheDocument();
  });

  it("a book WITH NO series shows the honest Sorozat note (project-global only, no ?series_id=)", async () => {
    const user = userEvent.setup();
    // Clear the Fárosz book's series so the active book has none.
    resetBookStore();
    server.use(
      http.get(`${base}/projects/:projectId/books`, ({ params }) =>
        HttpResponse.json([
          { ...FAROSZ_BOOK, project_id: String(params.projectId), series_id: null },
        ]),
      ),
    );
    const codexUrls: string[] = [];
    server.use(
      http.get(`${base}/projects/:projectId/codex`, ({ request }) => {
        codexUrls.push(request.url);
        return HttpResponse.json([]);
      }),
    );

    renderSidebar();
    await screen.findByRole("button", { name: "Sorozat" });
    await user.click(screen.getByRole("button", { name: "Sorozat" }));

    // The honest note appears (NOT a fake/empty series Codex).
    expect(
      await screen.findByText(/nincs sorozat társítva/i),
    ).toBeInTheDocument();
    // And no series_id query was issued (we fall back to the project list).
    expect(codexUrls.every((u) => !u.includes("series_id="))).toBe(true);
  });

  it("creates a series from the manage popover", async () => {
    const user = userEvent.setup();
    renderSidebar();
    await screen.findByText("Szelene");

    await user.click(screen.getByRole("button", { name: "Sorozatok kezelése" }));
    const nameInput = await screen.findByLabelText("Új sorozat");
    await user.type(nameInput, "Harmadik ciklus");
    await user.click(screen.getByRole("button", { name: /Létrehozás/ }));

    // The new series appears in the manage list (rename control labelled by it).
    expect(
      await screen.findByLabelText("Harmadik ciklus átnevezése"),
    ).toBeInTheDocument();
  });

  it("assigns the book to a series, and surfaces the backend 400 for a cross-project series", async () => {
    const user = userEvent.setup();
    // Start with the book unassigned so picking a series triggers a PATCH.
    server.use(
      http.get(`${base}/projects/:projectId/books`, ({ params }) =>
        HttpResponse.json([
          { ...FAROSZ_BOOK, project_id: String(params.projectId), series_id: null },
        ]),
      ),
    );
    renderSidebar();
    await screen.findByText("Szelene");

    await user.click(screen.getByRole("button", { name: "Sorozatok kezelése" }));
    const select = (await screen.findByLabelText(
      "A könyv sorozatának kiválasztása",
    )) as HTMLSelectElement;
    // Wait for the series option to load before selecting it.
    await waitFor(() =>
      expect(
        within(select).queryByRole("option", { name: FAROSZ_SERIES.title }),
      ).toBeInTheDocument(),
    );

    // Make the PATCH reject (cross-project series → 400).
    server.use(
      http.patch(`${base}/projects/:projectId/books/:bookId`, () =>
        HttpResponse.json(
          { detail: "A sorozat egy másik projekthez tartozik." },
          { status: 400 },
        ),
      ),
    );
    // Pick the series option (assignment attempt).
    await user.selectOptions(select, FAROSZ_SERIES.id);

    // The 400 detail surfaces (toast) — never swallowed.
    expect(
      await screen.findByText(/másik projekthez tartozik/i),
    ).toBeInTheDocument();
  });
});

/* -------------------------------------------------------------------------- */
/* Codex entry scope picker (detail)                                          */
/* -------------------------------------------------------------------------- */

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

describe("Codex entry scope picker", () => {
  beforeEach(() => {
    resetSeriesStore();
  });

  it("sends series_id when the entry is re-scoped to a series", async () => {
    const user = userEvent.setup();
    const patches: Record<string, unknown>[] = [];
    server.use(
      http.patch(
        `${base}/projects/:projectId/codex/:entryId`,
        async ({ request, params }) => {
          const body = (await request.json()) as Record<string, unknown>;
          patches.push(body);
          return HttpResponse.json({
            ...SZELENE,
            ...body,
            id: String(params.entryId),
            project_id: String(params.projectId),
          });
        },
      ),
    );

    render(
      <Providers>
        <CodexDetail
          entry={SZELENE}
          projectId={FAROSZ_PROJECT.id}
          bookId={FAROSZ_BOOK.id}
          onDeleted={() => {}}
        />
      </Providers>,
    );

    const scope = (await screen.findByLabelText("Hatókör")) as HTMLSelectElement;
    // Wait for the series option to load before selecting it.
    await waitFor(() =>
      expect(
        within(scope).queryByRole("option", { name: FAROSZ_SERIES.title }),
      ).toBeInTheDocument(),
    );
    await user.selectOptions(scope, FAROSZ_SERIES.id);

    await waitFor(() => expect(patches).toHaveLength(1));
    expect(patches[0]).toMatchObject({ series_id: FAROSZ_SERIES.id });
  });

  it("offers the project-global option for an entry", async () => {
    render(
      <Providers>
        <CodexDetail
          entry={{ ...SZELENE, series_id: FAROSZ_SERIES.id }}
          projectId={FAROSZ_PROJECT.id}
          bookId={FAROSZ_BOOK.id}
          onDeleted={() => {}}
        />
      </Providers>,
    );
    const scope = (await screen.findByLabelText("Hatókör")) as HTMLSelectElement;
    expect(
      within(scope).getByRole("option", {
        name: "Projekt-szintű (minden könyv)",
      }),
    ).toBeInTheDocument();
  });
});
