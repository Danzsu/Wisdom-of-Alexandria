import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { useUIStore } from "@/lib/stores/ui-store";
import {
  CHAPTER_TWO,
  FAROSZ_BOOK,
  SCENE_ACTIVE,
} from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;
const push = vi.fn();
let params: Record<string, string | undefined> = {
  bookId: FAROSZ_BOOK.id,
  sceneId: SCENE_ACTIVE.id,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/konyv/x/iras/y",
  useParams: () => params,
}));

import { ChapterTree } from "../chapter-tree";

describe("ChapterTree", () => {
  beforeEach(() => {
    push.mockClear();
    params = { bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id };
    useUIStore.setState({ openMenu: null, commandOpen: false, sparkActive: false });
  });
  afterEach(() => useUIStore.getState().clearSpark());

  it("renders chapters + scenes from the API", async () => {
    render(
      <Providers>
        <ChapterTree />
      </Providers>,
    );
    expect(
      await screen.findByText(CHAPTER_TWO.title),
    ).toBeInTheDocument();
    expect(await screen.findByText(SCENE_ACTIVE.title)).toBeInTheDocument();
  });

  it("marks the active scene with aria-current", async () => {
    render(
      <Providers>
        <ChapterTree />
      </Providers>,
    );
    const active = await screen.findByRole("button", {
      name: SCENE_ACTIVE.title,
    });
    expect(active).toHaveAttribute("aria-current", "true");
  });

  it("navigates to a scene on click", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <ChapterTree />
      </Providers>,
    );
    const sceneRow = await screen.findByRole("button", {
      name: SCENE_ACTIVE.title,
    });
    await user.click(sceneRow);
    expect(push).toHaveBeenCalledWith(
      `/konyv/${FAROSZ_BOOK.id}/iras/${SCENE_ACTIVE.id}`,
    );
  });

  it("surfaces an error (not swallowed)", async () => {
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    render(
      <Providers>
        <ChapterTree />
      </Providers>,
    );
    await waitFor(() =>
      expect(
        screen.getByText("Nem sikerült betölteni a fejezeteket"),
      ).toBeInTheDocument(),
    );
  });
});
