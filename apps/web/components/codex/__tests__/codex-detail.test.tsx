import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { resetCodexStore } from "@/test/msw/handlers";
import { FAROSZ_BOOK, FAROSZ_PROJECT } from "@/test/msw/fixtures";
import { CodexDetail } from "@/components/codex/codex-detail";
import type { CodexEntryRead } from "@/lib/api/types";
import { hu } from "@/lib/i18n/hu";

const base = `${API_BASE_URL}/api/v1`;

const SZELENE: CodexEntryRead = {
  id: "codex-szelene",
  project_id: FAROSZ_PROJECT.id,
  series_id: null,
  title: "Szelene",
  entry_type: "character",
  content: "A Nagykönyvtár éjszakai írnoka.",
  // P1.4 — aliases + role are now dedicated columns, not a `tags` codec.
  aliases: ["Lené"],
  role: "Protagonista",
  ai_visible: true,
  tags: [],
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

/** Capture every PATCH body sent to the entry. */
function capturePatches(): { bodies: unknown[] } {
  const bodies: unknown[] = [];
  server.use(
    http.patch(
      `${base}/projects/:projectId/codex/:entryId`,
      async ({ request, params }) => {
        const body = (await request.json()) as Record<string, unknown>;
        bodies.push(body);
        return HttpResponse.json({
          ...SZELENE,
          ...body,
          id: String(params.entryId),
          project_id: String(params.projectId),
        });
      },
    ),
  );
  return { bodies };
}

function renderDetail(onDeleted = vi.fn()) {
  return render(
    <Providers>
      <CodexDetail
        entry={SZELENE}
        projectId={FAROSZ_PROJECT.id}
        bookId={FAROSZ_BOOK.id}
        onDeleted={onDeleted}
      />
    </Providers>,
  );
}

describe("CodexDetail", () => {
  beforeEach(() => resetCodexStore());
  afterEach(() => server.events.removeAllListeners());

  it("renders the entry header (name, type, role) and existing aliases", () => {
    renderDetail();
    expect(screen.getByLabelText("Bejegyzés neve")).toHaveValue("Szelene");
    expect(screen.getByText("Karakter")).toBeInTheDocument();
    // The role chip + alias chip are both rendered.
    expect(screen.getAllByText("Protagonista").length).toBeGreaterThan(0);
    expect(screen.getByText("Lené")).toBeInTheDocument();
  });

  it("editing the description PATCHes content", async () => {
    const user = userEvent.setup();
    const { bodies } = capturePatches();
    renderDetail();

    const desc = screen.getByLabelText("Leírás");
    await user.clear(desc);
    await user.type(desc, "Új leírás.");
    await user.tab(); // blur commits

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(bodies.at(-1)).toMatchObject({ content: "Új leírás." });
  });

  it("adding an alias PATCHes the dedicated aliases field", async () => {
    const user = userEvent.setup();
    const { bodies } = capturePatches();
    renderDetail();

    const aliasInput = screen.getByPlaceholderText("vesszővel elválasztva…");
    await user.type(aliasInput, "az írnok{Enter}");

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    const last = bodies.at(-1) as { aliases: string[] };
    // The new alias is appended to the existing aliases (Lené), not folded into tags.
    expect(last.aliases).toEqual(["Lené", "az írnok"]);
  });

  it("editing the story role PATCHes the dedicated role field", async () => {
    const user = userEvent.setup();
    const { bodies } = capturePatches();
    renderDetail();

    const role = screen.getByLabelText("Szerep a történetben");
    await user.clear(role);
    await user.type(role, "Antagonista");
    await user.tab();

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(bodies.at(-1)).toMatchObject({ role: "Antagonista" });
  });

  it("the ai_visible toggle persists via PATCH (assert request body)", async () => {
    const user = userEvent.setup();
    const { bodies } = capturePatches();
    renderDetail();

    // Switch to the Nyomon követés tab.
    await user.click(screen.getByRole("tab", { name: "Nyomon követés" }));

    // Check "Rejtett az AI-tól" → ai_visible becomes false.
    const hidden = screen.getByText("Rejtett az AI-tól");
    await user.click(hidden);

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    expect(bodies.at(-1)).toMatchObject({ ai_visible: false });
  });

  it("MentionsTab resolves SkeletonList and shows matched mention entries", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("tab", { name: hu.codex.tabMentions }));

    // SkeletonList renders while the book tree loads; wait for it to settle.
    await waitFor(() =>
      expect(screen.queryByTestId("skeleton-list")).not.toBeInTheDocument(),
    );
    // SCENE_ACTIVE content contains "Szelene" — one mention row expected.
    expect(
      await screen.findByText(/Szelene a tekercsek közé hajolt/),
    ).toBeInTheDocument();
  });

  it("MentionsTab ErrorState retry refetches chapters and clears the error", async () => {
    server.use(
      http.get(`${API_BASE_URL}/api/v1/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "tree-boom" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderDetail();

    // Switch to the Megemlítések tab.
    await user.click(screen.getByRole("tab", { name: hu.codex.tabMentions }));

    // ErrorState appears (role="alert").
    await screen.findByRole("alert");

    // Restore the success handler before clicking retry.
    server.resetHandlers();

    await user.click(screen.getByRole("button", { name: hu.common.retry }));

    // Error disappears; the mention row from SCENE_ACTIVE appears.
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText(/Szelene a tekercsek közé hajolt/),
    ).toBeInTheDocument();
  });

  it("delete asks for confirmation then DELETEs", async () => {
    const user = userEvent.setup();
    const onDeleted = vi.fn();
    const calls: { method: string; path: string }[] = [];
    server.events.on("request:start", ({ request }) => {
      calls.push({ method: request.method, path: new URL(request.url).pathname });
    });

    renderDetail(onDeleted);

    await user.click(screen.getByRole("button", { name: "Bejegyzés törlése" }));
    // ConfirmDialog appears.
    const confirm = await screen.findByRole("button", {
      name: "Végleges törlés",
    });
    await user.click(confirm);

    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    expect(
      calls.some(
        (c) =>
          c.method === "DELETE" &&
          c.path.endsWith(`/codex/${SZELENE.id}`),
      ),
    ).toBe(true);
  });
});
