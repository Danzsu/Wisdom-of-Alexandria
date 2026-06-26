import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { SCENE_ACTIVE, FAROSZ_BOOK } from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;

// Two distinctive revisions: stable ids, distinct model/version/status, and a
// content that, diffed against CURRENT below, yields a known removed + added bit.
const CURRENT_CONTENT = "A levegő hideg volt, és csend.";
const REV_NEWER = {
  id: "rev-newer",
  scene_id: SCENE_ACTIVE.id,
  job_id: "job-newer",
  content: "A könyvtár alsó szintjén a levegő sűrű volt a portól.",
  approved: false,
  revision_type: "rewrite",
  model_name: "qwen2.5-newer",
  prompt_version: "2.0",
  created_at: "2026-06-20T10:00:00Z",
  updated_at: "2026-06-20T10:00:00Z",
};
const REV_OLDER = {
  id: "rev-older",
  scene_id: SCENE_ACTIVE.id,
  job_id: "job-older",
  content: "Egy teljesen más, korábbi változat a jelenetről.",
  approved: true,
  revision_type: "generate_scene",
  model_name: "gemini-older",
  prompt_version: "1.0",
  created_at: "2026-06-18T08:00:00Z",
  updated_at: "2026-06-18T08:00:00Z",
};

import { RevisionHistoryPanel } from "../revision-history-panel";

function renderPanel(
  overrides?: Partial<{
    open: boolean;
    onOpenChange: (open: boolean) => void;
    sceneId: string | undefined;
    sceneContent: string;
  }>,
) {
  const onOpenChange = overrides?.onOpenChange ?? vi.fn();
  render(
    <Providers>
      <RevisionHistoryPanel
        open={overrides?.open ?? true}
        onOpenChange={onOpenChange}
        sceneId={
          overrides?.sceneId === undefined && !("sceneId" in (overrides ?? {}))
            ? SCENE_ACTIVE.id
            : overrides?.sceneId
        }
        sceneContent={overrides?.sceneContent ?? CURRENT_CONTENT}
        bookId={FAROSZ_BOOK.id}
      />
    </Providers>,
  );
  return { onOpenChange };
}

function seedTwoRevisions() {
  // Newest first (the API orders DESC; we assert the panel preserves that).
  server.use(
    http.get(`${base}/revisions`, () =>
      HttpResponse.json([REV_NEWER, REV_OLDER]),
    ),
  );
}

describe("RevisionHistoryPanel", () => {
  beforeEach(() => {
    seedTwoRevisions();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("lists the scene's revisions newest-first with per-version status + model", async () => {
    renderPanel();

    // Both versions appear, each carrying its own distinctive model name.
    expect(await screen.findByText("qwen2.5-newer")).toBeInTheDocument();
    expect(screen.getByText("gemini-older")).toBeInTheDocument();

    const items = screen.getAllByRole("button", {
      name: /verzió kiválasztása/i,
    });
    // Exactly the two seeded version rows (the close + restore buttons carry
    // other accessible names).
    expect(items).toHaveLength(2);
    // Newest-first: the newer revision's row precedes the older one.
    const newerRow = screen.getByText("qwen2.5-newer").closest("button");
    const olderRow = screen.getByText("gemini-older").closest("button");
    if (!newerRow || !olderRow) throw new Error("rows not found");
    const position = newerRow.compareDocumentPosition(olderRow);
    expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows a diff of the SELECTED version vs current — that version's removed AND added text", async () => {
    const user = userEvent.setup();
    renderPanel();

    // Select the newer version explicitly.
    await user.click(await screen.findByText("qwen2.5-newer"));

    // A removed bit unique to the CURRENT scene text, struck through (deletion).
    const removed = await screen.findByText("csend.", { exact: false });
    // An added bit unique to the SELECTED revision (addition).
    const added = await screen.findByText("portól.", { exact: false });

    // Prove it is THAT version's diff: removed carries a line-through (deletion)
    // and added does not — i.e. distinct diff markers, not a static blob.
    expect(removed.className).toMatch(/line-through/);
    expect(added.className).not.toMatch(/line-through/);

    // And it is NOT the other version's content.
    expect(
      screen.queryByText("korábbi", { exact: false }),
    ).not.toBeInTheDocument();
  });

  it("Restore approves the CORRECT revision id and surfaces success + closes", async () => {
    const approved: string[] = [];
    server.use(
      http.post(`${base}/revisions/:revisionId/approve`, ({ params }) => {
        approved.push(String(params.revisionId));
        return HttpResponse.json({ ...REV_OLDER, id: String(params.revisionId), approved: true });
      }),
    );

    const user = userEvent.setup();
    const { onOpenChange } = renderPanel();

    // Select the OLDER version, then restore — the approve must target rev-older,
    // not the default/first row.
    await user.click(await screen.findByText("gemini-older"));
    await user.click(screen.getByRole("button", { name: /Visszaállítás/ }));

    await waitFor(() => expect(approved).toEqual(["rev-older"]));
    expect(
      await screen.findByText(/visszaállítva/i),
    ).toBeInTheDocument();
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("Esc closes the panel", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderPanel();
    await screen.findByText("qwen2.5-newer");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("loading shows a skeleton, then content", async () => {
    renderPanel();
    // The list region exists immediately; the model names arrive after fetch.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await screen.findByText("qwen2.5-newer")).toBeInTheDocument();
  });

  it("error shows an error state", async () => {
    server.use(
      http.get(`${base}/revisions`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderPanel();
    expect(
      await screen.findByText(/nem sikerült/i),
    ).toBeInTheDocument();
  });

  it("empty shows an empty state", async () => {
    server.use(http.get(`${base}/revisions`, () => HttpResponse.json([])));
    renderPanel();
    expect(
      await screen.findByText(/még nincs/i),
    ).toBeInTheDocument();
  });

  it("has no a11y violations with the panel open", async () => {
    renderPanel();
    await screen.findByText("qwen2.5-newer");
    await expectNoA11yViolations(document);
  });

  it("does not render when closed", () => {
    renderPanel({ open: false });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
