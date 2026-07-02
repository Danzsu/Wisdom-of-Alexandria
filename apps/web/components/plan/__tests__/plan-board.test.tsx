import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  CHAPTER_ONE,
  CHAPTER_TWO,
  FAROSZ_BOOK,
  SCENE_ACTIVE,
  SCENE_FIRST,
} from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;
const push = vi.fn();
let params: Record<string, string | undefined> = { bookId: FAROSZ_BOOK.id };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/konyv/x/terv",
  useParams: () => params,
}));

import { PlanBoard } from "../plan-board";

function renderBoard() {
  return render(
    <Providers>
      <PlanBoard />
    </Providers>,
  );
}

describe("PlanBoard", () => {
  beforeEach(() => {
    push.mockClear();
    params = { bookId: FAROSZ_BOOK.id };
    useUIStore.setState({
      openMenu: null,
      commandOpen: false,
      sparkActive: false,
    });
  });
  afterEach(() => useUIStore.getState().clearSpark());

  it("renders chapters + scenes from the API in the Grid view", async () => {
    renderBoard();
    expect(await screen.findByText(CHAPTER_ONE.title)).toBeInTheDocument();
    expect(await screen.findByText(CHAPTER_TWO.title)).toBeInTheDocument();
    expect(await screen.findByText(SCENE_ACTIVE.title)).toBeInTheDocument();
    expect(await screen.findByText(SCENE_FIRST.title)).toBeInTheDocument();
  });

  it("surfaces a load error via ErrorState (not swallowed)", async () => {
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "kaboom" }, { status: 500 }),
      ),
    );
    renderBoard();
    expect(
      await screen.findByText("Nem sikerült betölteni a tervet"),
    ).toBeInTheDocument();
    expect(await screen.findByText("kaboom")).toBeInTheDocument();
    // ErrorState renders role="alert"
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("retry button on ErrorState refetches and clears the error", async () => {
    // Start with a failing endpoint.
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "kaboom" }, { status: 500 }),
      ),
    );
    const user = userEvent.setup();
    renderBoard();

    // Wait for the error state to appear.
    await screen.findByRole("alert");
    expect(
      screen.getByText("Nem sikerült betölteni a tervet"),
    ).toBeInTheDocument();

    // Restore the successful handler before clicking retry.
    server.resetHandlers();

    // Click the retry button.
    await user.click(screen.getByRole("button", { name: "Újrapróbálkozás" }));

    // The board should now render the chapter list (error gone).
    expect(
      await screen.findByText(CHAPTER_ONE.title),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("loading state renders SkeletonCard placeholders", async () => {
    // Delay the response so we can observe the loading state.
    server.use(
      http.get(`${base}/books/:bookId/chapters`, async () => {
        await new Promise((r) => setTimeout(r, 200));
        return HttpResponse.json([]);
      }),
    );
    renderBoard();
    // SkeletonCard uses data-testid="skeleton-card"
    expect(
      (await screen.findAllByTestId("skeleton-card")).length,
    ).toBeGreaterThan(0);
  });

  it("switches to the Matrix view", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByText(CHAPTER_ONE.title);
    await user.click(screen.getByRole("radio", { name: "Mátrix" }));
    // The matrix footnote is unique to that view.
    expect(
      await screen.findByText(
        "A jelenetek státusz szerint rendezve. Kattints egy cellára a jelenet megnyitásához.",
      ),
    ).toBeInTheDocument();
  });

  it("switches to the Outline view and marks the current scene", async () => {
    params = { bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id };
    const user = userEvent.setup();
    renderBoard();
    await screen.findByText(CHAPTER_ONE.title);
    await user.click(screen.getByRole("radio", { name: "Vázlat" }));
    // The current scene is marked with "· jelenlegi".
    expect(await screen.findByText(/· jelenlegi/)).toBeInTheDocument();
  });

  it("density toggle hides the summary then the POV", async () => {
    // Seed a scene with a summary + a resolvable POV so we can watch both hide.
    server.use(
      http.get(`${base}/chapters/:chapterId/scenes`, ({ params: p }) => {
        if (p.chapterId === CHAPTER_ONE.id) {
          return HttpResponse.json([
            {
              ...SCENE_FIRST,
              summary: "Egy érzéki összefoglaló.",
              pov_character_id: "codex-szelene",
            },
          ]);
        }
        return HttpResponse.json([SCENE_ACTIVE]);
      }),
    );
    const user = userEvent.setup();
    renderBoard();
    expect(
      await screen.findByText("Egy érzéki összefoglaló."),
    ).toBeInTheDocument();
    // The POV badge resolves to the character name "Szelene".
    expect(await screen.findByText("Szelene")).toBeInTheDocument();

    // Compact hides the summary, keeps the POV.
    await user.click(screen.getByRole("radio", { name: "Kompakt sűrűség" }));
    await waitFor(() =>
      expect(
        screen.queryByText("Egy érzéki összefoglaló."),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText("Szelene")).toBeInTheDocument();

    // Slim hides the POV too.
    await user.click(screen.getByRole("radio", { name: "Slim sűrűség" }));
    await waitFor(() =>
      expect(screen.queryByText("Szelene")).not.toBeInTheDocument(),
    );
  });

  it("creates a chapter via the act '+ Új fejezet' and the board updates", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByText(CHAPTER_ONE.title);

    // Spy on the real (stateful) POST so we assert it fired with the default
    // title, then let the store persist it and the invalidation refetch show it.
    let postedTitle: string | null = null;
    server.use(
      http.post(`${base}/books/:bookId/chapters`, async ({ request }) => {
        const body = (await request.json()) as { title: string };
        postedTitle = body.title;
        return HttpResponse.json(
          {
            id: "chapter-created-1",
            book_id: FAROSZ_BOOK.id,
            title: body.title,
            summary: null,
            order_index: 2,
            status: "draft",
            created_at: "2026-06-14T18:00:00Z",
            updated_at: "2026-06-14T18:00:00Z",
          },
          { status: 201 },
        );
      }),
      // The post-create invalidation refetch returns the original two chapters
      // plus the freshly-created one so the board reflects it.
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json([
          CHAPTER_ONE,
          CHAPTER_TWO,
          {
            id: "chapter-created-1",
            book_id: FAROSZ_BOOK.id,
            title: "3. fejezet",
            summary: null,
            order_index: 2,
            status: "draft",
            created_at: "2026-06-14T18:00:00Z",
            updated_at: "2026-06-14T18:00:00Z",
          },
        ]),
      ),
    );

    await user.click(screen.getByRole("button", { name: "Új fejezet" }));
    await waitFor(() => expect(postedTitle).toBe("3. fejezet"));
    // The new chapter appears after the invalidation refetch.
    expect(await screen.findByText("3. fejezet")).toBeInTheDocument();
  });

  it("empty-book → 'Első fejezet létrehozása' creates a chapter + scene and navigates", async () => {
    // Book with NO chapters → the empty-book CTA.
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () => HttpResponse.json([])),
    );
    const user = userEvent.setup();
    renderBoard();

    const cta = await screen.findByRole("button", {
      name: "Első fejezet létrehozása",
    });

    let chapterPosted = false;
    let scenePosted = false;
    server.use(
      http.post(`${base}/books/:bookId/chapters`, async ({ request }) => {
        chapterPosted = true;
        const body = (await request.json()) as { title: string };
        return HttpResponse.json(
          {
            id: "first-chapter",
            book_id: FAROSZ_BOOK.id,
            title: body.title,
            summary: null,
            order_index: 0,
            status: "draft",
            created_at: "2026-06-14T18:00:00Z",
            updated_at: "2026-06-14T18:00:00Z",
          },
          { status: 201 },
        );
      }),
      http.post(
        `${base}/chapters/:chapterId/scenes`,
        async ({ request, params: p }) => {
          scenePosted = true;
          const body = (await request.json()) as { title: string };
          return HttpResponse.json(
            {
              id: "first-scene",
              chapter_id: String(p.chapterId),
              title: body.title,
              content: null,
              summary: null,
              order_index: 0,
              status: "draft",
              word_count: 0,
              pov_character_id: null,
              location_id: null,
              created_at: "2026-06-14T18:00:00Z",
              updated_at: "2026-06-14T18:00:00Z",
            },
            { status: 201 },
          );
        },
      ),
    );

    await user.click(cta);

    await waitFor(() => expect(chapterPosted).toBe(true));
    await waitFor(() => expect(scenePosted).toBe(true));
    // The create→write loop closes: it navigates to the new scene's editor.
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/konyv/${FAROSZ_BOOK.id}/iras/first-scene`,
      ),
    );
  });

  it("creates a scene via a chapter '+ Új jelenet' and navigates to it", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByText(CHAPTER_ONE.title);

    let scenePosted: string | null = null;
    server.use(
      http.post(
        `${base}/chapters/:chapterId/scenes`,
        async ({ params: p }) => {
          scenePosted = String(p.chapterId);
          return HttpResponse.json(
            {
              id: "scene-created-1",
              chapter_id: String(p.chapterId),
              title: "Új jelenet",
              content: null,
              summary: null,
              order_index: 1,
              status: "draft",
              word_count: 0,
              pov_character_id: null,
              location_id: null,
              created_at: "2026-06-14T18:00:00Z",
              updated_at: "2026-06-14T18:00:00Z",
            },
            { status: 201 },
          );
        },
      ),
    );

    // There is one "+ Új jelenet" per chapter column; click the first.
    const newSceneButtons = await screen.findAllByRole("button", {
      name: "Új jelenet",
    });
    await user.click(newSceneButtons[0]);

    await waitFor(() => expect(scenePosted).not.toBeNull());
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith(
        `/konyv/${FAROSZ_BOOK.id}/iras/scene-created-1`,
      ),
    );
  });

  it("scene kebab → Törlés → confirm fires DELETE", async () => {
    const user = userEvent.setup();
    renderBoard();
    await screen.findByText(SCENE_FIRST.title);

    let deleted: string | null = null;
    server.use(
      http.delete(
        `${base}/chapters/:chapterId/scenes/:sceneId`,
        ({ params: p }) => {
          deleted = String(p.sceneId);
          return new HttpResponse(null, { status: 204 });
        },
      ),
    );

    // Open the kebab on the first scene card.
    const kebabs = screen.getAllByRole("button", { name: "Jelenet műveletek" });
    await user.click(kebabs[0]);
    // Click the danger "Törlés" row.
    await user.click(await screen.findByRole("menuitem", { name: "Törlés" }));
    // Confirm in the AlertDialog.
    const dialog = await screen.findByRole("alertdialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Végleges törlés" }),
    );

    await waitFor(() => expect(deleted).not.toBeNull());
  });

  it("opening a scene from the grid navigates to the editor", async () => {
    const user = userEvent.setup();
    renderBoard();
    const sceneTitle = await screen.findByText(SCENE_FIRST.title);
    await user.click(sceneTitle);
    expect(push).toHaveBeenCalledWith(
      `/konyv/${FAROSZ_BOOK.id}/iras/${SCENE_FIRST.id}`,
    );
  });
});
