/**
 * Progresszió tab (codex detail) — component tests over the real MSW path.
 *
 * Mutation-proofing notes:
 * - The ORDER test's fixture (`SZELENE_PROGRESSIONS`) is seeded so that story
 *   order ≠ created_at asc ≠ created_at desc ≠ array order — only the real
 *   story-position sort (anchorless → chapter → scene, mirroring the backend
 *   progression_service linearization) yields the asserted sequence.
 * - Create/edit tests capture the EXACT request payloads (deep equality) via
 *   MSW events while the stateful store serves the request, so the payload
 *   contract AND the invalidation round-trip are both pinned.
 * - The entity binding is pinned to `entity_type: "codex"` — the key the
 *   RAG/AI-context filter reads for generic codex entries; any other value
 *   would create rows the AI never sees.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  resetCodexStore,
  resetProgressionStore,
  resetRelationStore,
} from "@/test/msw/handlers";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  SCENE_ACTIVE,
} from "@/test/msw/fixtures";
import { expectNoA11yViolations } from "@/test/a11y";
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
  aliases: ["Lené"],
  role: "Protagonista",
  ai_visible: true,
  tags: [],
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

/** Fixture notes, named for readability in the order assertions. */
const NOTE_GLOBAL = "Alapállapot: éjszakai írnok a Nagykönyvtárban.";
const NOTE_CHAPTER = "A kikötőben szolgál, gyanút fog.";
const NOTE_SCENE = "Már tud a rejtett jelekről.";

/** Capture request bodies via MSW events without overriding the handler. */
function captureBodies(method: string, pathIncludes: string): unknown[] {
  const bodies: unknown[] = [];
  server.events.on("request:start", ({ request }) => {
    if (
      request.method === method &&
      new URL(request.url).pathname.includes(pathIncludes)
    ) {
      void request
        .clone()
        .json()
        .then((body) => bodies.push(body));
    }
  });
  return bodies;
}

/** Capture matching request URL pathnames (for body-less DELETEs / PATCH ids). */
function captureUrls(method: string, pathIncludes: string): string[] {
  const urls: string[] = [];
  server.events.on("request:start", ({ request }) => {
    if (
      request.method === method &&
      new URL(request.url).pathname.includes(pathIncludes)
    ) {
      urls.push(new URL(request.url).pathname);
    }
  });
  return urls;
}

async function renderProgressionTab() {
  const user = userEvent.setup();
  const view = render(
    <Providers>
      <CodexDetail
        entry={SZELENE}
        projectId={FAROSZ_PROJECT.id}
        bookId={FAROSZ_BOOK.id}
        onDeleted={vi.fn()}
      />
    </Providers>,
  );
  await user.click(screen.getByRole("tab", { name: hu.codex.tabProgress }));
  return { user, view };
}

describe("CodexDetail — Progresszió tab", () => {
  beforeEach(() => {
    resetCodexStore();
    resetRelationStore();
    resetProgressionStore();
  });
  afterEach(() => server.events.removeAllListeners());

  it("lists progressions in STORY order (global baseline → chapter → scene), not created_at order", async () => {
    await renderProgressionTab();

    const list = await screen.findByRole("list", {
      name: hu.codexProgressions.listAria,
    });
    // Wait until every row is present (the book tree fans out per-chapter).
    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")).toHaveLength(3),
    );
    const rows = within(list).getAllByRole("listitem");

    // EXACT sequence: anchorless baseline, chapter-one anchor, scene anchor.
    expect(rows[0]).toHaveTextContent(NOTE_GLOBAL);
    expect(rows[1]).toHaveTextContent(NOTE_CHAPTER);
    expect(rows[2]).toHaveTextContent(NOTE_SCENE);

    // Anchor labels: global marker, chapter title, "chapter · scene".
    expect(
      within(rows[0]).getByText(hu.codexProgressions.anchorGlobal),
    ).toBeInTheDocument();
    expect(within(rows[1]).getByText(CHAPTER_ONE.title)).toBeInTheDocument();
    expect(
      within(rows[2]).getByText(
        hu.codexProgressions.anchorScene(CHAPTER_TWO.title, SCENE_ACTIVE.title),
      ),
    ).toBeInTheDocument();
  });

  it("creates a scene-anchored progression: POSTs the exact payload and the row appears", async () => {
    const bodies = captureBodies("POST", "/codex-progressions");
    const { user } = await renderProgressionTab();
    await screen.findByRole("list", { name: hu.codexProgressions.listAria });

    await user.click(
      screen.getByRole("button", { name: hu.codexProgressions.addNew }),
    );
    const dialog = await screen.findByRole("dialog");

    // Cascading anchor picker: chapter → its scenes.
    await user.selectOptions(
      within(dialog).getByLabelText(hu.codexProgressions.modalAnchorLabel),
      CHAPTER_TWO.id,
    );
    await user.selectOptions(
      await within(dialog).findByLabelText(hu.codexProgressions.modalSceneLabel),
      SCENE_ACTIVE.id,
    );
    await user.type(
      within(dialog).getByLabelText(hu.codexProgressions.modalNoteLabel),
      "Megsérült a bal karján.",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: hu.codexProgressions.modalCreate,
      }),
    );

    // EXACT payload: entity binding (codex!), both anchor ids, the note.
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      entity_type: "codex",
      entity_id: "codex-szelene",
      chapter_id: CHAPTER_TWO.id,
      scene_id: SCENE_ACTIVE.id,
      note: "Megsérült a bal karján.",
    });

    // Round-trip: the store persisted it; the invalidated list shows it.
    await waitFor(() =>
      expect(screen.getByText("Megsérült a bal karján.")).toBeInTheDocument(),
    );
  });

  it("creates an anchorless (global baseline) progression with null anchors", async () => {
    const bodies = captureBodies("POST", "/codex-progressions");
    const { user } = await renderProgressionTab();
    await screen.findByRole("list", { name: hu.codexProgressions.listAria });

    await user.click(
      screen.getByRole("button", { name: hu.codexProgressions.addNew }),
    );
    const dialog = await screen.findByRole("dialog");
    // Default anchor is the global baseline — no scene select is shown.
    expect(
      within(dialog).queryByLabelText(hu.codexProgressions.modalSceneLabel),
    ).not.toBeInTheDocument();
    await user.type(
      within(dialog).getByLabelText(hu.codexProgressions.modalNoteLabel),
      "Kiinduló állapot.",
    );
    await user.click(
      within(dialog).getByRole("button", {
        name: hu.codexProgressions.modalCreate,
      }),
    );

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({
      entity_type: "codex",
      entity_id: "codex-szelene",
      chapter_id: null,
      scene_id: null,
      note: "Kiinduló állapot.",
    });
  });

  it("requires a note: submitting empty shows an inline error and never POSTs", async () => {
    const bodies = captureBodies("POST", "/codex-progressions");
    const { user } = await renderProgressionTab();
    await screen.findByRole("list", { name: hu.codexProgressions.listAria });

    await user.click(
      screen.getByRole("button", { name: hu.codexProgressions.addNew }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", {
        name: hu.codexProgressions.modalCreate,
      }),
    );

    expect(
      await within(dialog).findByText(hu.codexProgressions.modalNoteRequired),
    ).toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it("edits a progression: prefills the modal and PATCHes the right id with the changed note", async () => {
    const bodies = captureBodies("PATCH", "/codex-progressions");
    const urls = captureUrls("PATCH", "/codex-progressions");
    const { user } = await renderProgressionTab();
    const list = await screen.findByRole("list", {
      name: hu.codexProgressions.listAria,
    });
    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")).toHaveLength(3),
    );

    await user.click(
      screen.getByRole("button", {
        name: hu.codexProgressions.editAria(NOTE_CHAPTER),
      }),
    );
    const dialog = await screen.findByRole("dialog");

    // Prefilled: the chapter anchor + the existing note.
    expect(
      within(dialog).getByLabelText(hu.codexProgressions.modalAnchorLabel),
    ).toHaveValue(CHAPTER_ONE.id);
    const note = within(dialog).getByLabelText(
      hu.codexProgressions.modalNoteLabel,
    );
    expect(note).toHaveValue(NOTE_CHAPTER);

    await user.clear(note);
    await user.type(note, "Már a fővárosban van.");
    await user.click(
      within(dialog).getByRole("button", {
        name: hu.codexProgressions.modalSave,
      }),
    );

    // The RIGHT row's id, with the full explicit anchor + changed note.
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(urls[0]).toBe("/api/v1/codex-progressions/prog-chapter");
    expect(bodies[0]).toEqual({
      chapter_id: CHAPTER_ONE.id,
      scene_id: null,
      note: "Már a fővárosban van.",
    });

    // Round-trip: the list re-renders with the updated note.
    await waitFor(() =>
      expect(screen.getByText("Már a fővárosban van.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(NOTE_CHAPTER)).not.toBeInTheDocument();
  });

  it("deletes a progression: DELETEs the right id and the row disappears", async () => {
    const urls = captureUrls("DELETE", "/codex-progressions");
    const { user } = await renderProgressionTab();
    const list = await screen.findByRole("list", {
      name: hu.codexProgressions.listAria,
    });
    await waitFor(() =>
      expect(within(list).getAllByRole("listitem")).toHaveLength(3),
    );

    await user.click(
      screen.getByRole("button", {
        name: hu.codexProgressions.deleteAria(NOTE_SCENE),
      }),
    );

    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls[0]).toBe("/api/v1/codex-progressions/prog-scene");
    await waitFor(() =>
      expect(screen.queryByText(NOTE_SCENE)).not.toBeInTheDocument(),
    );
    // The other two rows survive.
    expect(screen.getByText(NOTE_GLOBAL)).toBeInTheDocument();
    expect(screen.getByText(NOTE_CHAPTER)).toBeInTheDocument();
  });

  it("shows an empty state with a CTA that opens the create modal", async () => {
    server.use(
      http.get(`${base}/codex-progressions`, () => HttpResponse.json([])),
    );
    const { user } = await renderProgressionTab();

    expect(
      await screen.findByRole("heading", {
        name: hu.codexProgressions.emptyTitle,
      }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: hu.codexProgressions.emptyCta }),
    );
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("surfaces a load error and recovers on retry", async () => {
    server.use(
      http.get(`${base}/codex-progressions`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const { user } = await renderProgressionTab();

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(hu.codexProgressions.error);

    server.resetHandlers();
    await user.click(screen.getByRole("button", { name: hu.common.retry }));
    await waitFor(() =>
      expect(
        screen.getByRole("list", { name: hu.codexProgressions.listAria }),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no a11y violations — tab content and open modal; Esc closes the dialog", async () => {
    const { user } = await renderProgressionTab();
    await screen.findByRole("list", { name: hu.codexProgressions.listAria });
    await expectNoA11yViolations(document);

    await user.click(
      screen.getByRole("button", { name: hu.codexProgressions.addNew }),
    );
    const dialog = await screen.findByRole("dialog");
    // Radix focus trap: focus lands inside the dialog.
    expect(dialog.contains(document.activeElement)).toBe(true);
    await expectNoA11yViolations(document);

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
