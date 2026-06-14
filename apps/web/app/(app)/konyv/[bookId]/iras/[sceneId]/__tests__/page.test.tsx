import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEditorStore } from "@/lib/stores/editor-store";
import {
  FAROSZ_BOOK,
  SCENE_ACTIVE,
  CHAPTER_TWO,
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

import IrasPage from "../page";
import { AiGenerationProvider } from "@/components/inspector/ai-generation-context";

function renderPage() {
  return render(
    <Providers>
      <AiGenerationProvider>
        <IrasPage />
      </AiGenerationProvider>
    </Providers>,
  );
}

describe("Write View page", () => {
  beforeEach(() => {
    push.mockClear();
    params = { bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id };
    useUIStore.setState({ openMenu: null, commandOpen: false, sparkActive: false });
    useEditorStore.setState({ aiFreeOn: false, wordCount: 0, saveState: "saved" });
  });
  afterEach(() => useUIStore.getState().clearSpark());

  it("loads the scene and renders the manuscript + toolbar + timeline", async () => {
    renderPage();
    // The chapter kicker (uppercased) + scene subtitle render once resolved.
    expect(
      await screen.findByText(CHAPTER_TWO.title.toUpperCase()),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: SCENE_ACTIVE.title }),
    ).toBeInTheDocument();
    // AI toolbar.
    expect(screen.getByRole("button", { name: /Formátum/ })).toBeInTheDocument();
    // Timeline rail.
    expect(
      screen.getByLabelText("Történet idősor"),
    ).toBeInTheDocument();
    // The persisted scene content shows in the editor.
    expect(
      await screen.findByText(/Szelene a tekercsek/),
    ).toBeInTheDocument();
  });

  it("seeds the live word count from the scene content", async () => {
    renderPage();
    await screen.findByText(/Szelene a tekercsek/);
    await waitFor(() =>
      expect(useEditorStore.getState().wordCount).toBeGreaterThan(0),
    );
  });

  it("shows a not-found state for an unknown scene", async () => {
    params = { bookId: FAROSZ_BOOK.id, sceneId: "does-not-exist" };
    renderPage();
    expect(
      await screen.findByText("A jelenet nem található ebben a könyvben."),
    ).toBeInTheDocument();
  });

  it("surfaces a load error (not swallowed)", async () => {
    server.use(
      http.get(`${base}/books/:bookId/chapters`, () =>
        HttpResponse.json({ detail: "load-fail" }, { status: 500 }),
      ),
    );
    renderPage();
    expect(
      await screen.findByText("Nem sikerült betölteni a jelenetet"),
    ).toBeInTheDocument();
    expect(screen.getByText("load-fail")).toBeInTheDocument();
  });

  it("switches to the clean-write bar when aiFree is on", async () => {
    renderPage();
    await screen.findByText(/Szelene a tekercsek/);
    fireEvent.click(screen.getByRole("button", { name: "Fókusz mód" }));
    // Toggle clean-write via the store (the rail clean-write toggle lives in the shell).
    useEditorStore.getState().setAiFree(true);
    expect(
      await screen.findByText("Tiszta írás mód"),
    ).toBeInTheDocument();
  });
});
