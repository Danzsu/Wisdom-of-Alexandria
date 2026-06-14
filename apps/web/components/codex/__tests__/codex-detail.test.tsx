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

const base = `${API_BASE_URL}/api/v1`;

const SZELENE: CodexEntryRead = {
  id: "codex-szelene",
  project_id: FAROSZ_PROJECT.id,
  title: "Szelene",
  entry_type: "character",
  content: "A Nagykönyvtár éjszakai írnoka.",
  ai_visible: true,
  tags: ["__woa:alias=Lené", "__woa:role=Protagonista"],
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

  it("adding an alias PATCHes the tags list (__woa:alias= key)", async () => {
    const user = userEvent.setup();
    const { bodies } = capturePatches();
    renderDetail();

    const aliasInput = screen.getByPlaceholderText("vesszővel elválasztva…");
    await user.type(aliasInput, "az írnok{Enter}");

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    const last = bodies.at(-1) as { tags: string[] };
    expect(last.tags).toEqual(
      expect.arrayContaining([
        "__woa:alias=Lené",
        "__woa:alias=az írnok",
        "__woa:role=Protagonista",
      ]),
    );
  });

  it("editing the story role PATCHes the __woa:role= key", async () => {
    const user = userEvent.setup();
    const { bodies } = capturePatches();
    renderDetail();

    const role = screen.getByLabelText("Szerep a történetben");
    await user.clear(role);
    await user.type(role, "Antagonista");
    await user.tab();

    await waitFor(() => expect(bodies.length).toBeGreaterThan(0));
    const last = bodies.at(-1) as { tags: string[] };
    expect(last.tags).toEqual(
      expect.arrayContaining(["__woa:role=Antagonista"]),
    );
    expect(last.tags).not.toEqual(
      expect.arrayContaining(["__woa:role=Protagonista"]),
    );
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
