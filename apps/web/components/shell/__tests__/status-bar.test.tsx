import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Providers } from "@/test/test-utils";
import { useEditorStore } from "@/lib/stores/editor-store";
import { FAROSZ_BOOK, SCENE_ACTIVE, CHAPTER_TWO } from "@/test/msw/fixtures";

let params: Record<string, string | undefined> = {
  bookId: FAROSZ_BOOK.id,
  sceneId: SCENE_ACTIVE.id,
};

vi.mock("next/navigation", () => ({
  useParams: () => params,
}));

import { StatusBar } from "../status-bar";

describe("StatusBar", () => {
  beforeEach(() => {
    params = { bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id };
    useEditorStore.setState({
      wordCount: 0,
      saveState: "saved",
      activeModel: null,
      retrySave: null,
    });
  });

  it("shows the live word count (tabular, Hungarian-grouped)", () => {
    useEditorStore.setState({ wordCount: 1482 });
    render(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    expect(screen.getByText("1 482 szó")).toBeInTheDocument();
  });

  it("resolves the chapter/scene location from the tree", async () => {
    render(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    await waitFor(() =>
      expect(
        screen.getByText(`${CHAPTER_TWO.title}, ${SCENE_ACTIVE.title}`),
      ).toBeInTheDocument(),
    );
  });

  it("reflects the autosave state", () => {
    useEditorStore.setState({ saveState: "saving" });
    const { rerender } = render(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    expect(screen.getByText("Mentés…")).toBeInTheDocument();

    useEditorStore.setState({ saveState: "error" });
    rerender(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    expect(screen.getByText("Mentés sikertelen")).toBeInTheDocument();

    useEditorStore.setState({ saveState: "saved" });
    rerender(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    expect(screen.getByText("Mentve")).toBeInTheDocument();
  });

  it("shows the retrying state while a failed save is auto-retried", () => {
    useEditorStore.setState({ saveState: "retrying" });
    render(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    expect(screen.getByText("Újrapróbálkozás…")).toBeInTheDocument();
    // Retrying is not yet the give-up state — no manual retry button.
    expect(
      screen.queryByRole("button", { name: "Mentés újrapróbálása" }),
    ).not.toBeInTheDocument();
  });

  it("error state offers a WORKING manual retry button (Mentés sikertelen — Újra)", () => {
    const retry = vi.fn();
    useEditorStore.setState({ saveState: "error", retrySave: retry });
    render(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    expect(screen.getByText("Mentés sikertelen")).toBeInTheDocument();
    const button = screen.getByRole("button", {
      name: "Mentés újrapróbálása",
    });
    expect(button).toHaveTextContent("Újra");
    fireEvent.click(button);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("error state without a registered retry bridge renders no dead button", () => {
    useEditorStore.setState({ saveState: "error", retrySave: null });
    render(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    expect(screen.getByText("Mentés sikertelen")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Mentés újrapróbálása" }),
    ).not.toBeInTheDocument();
  });

  it("shows the active (config-driven) model badge", async () => {
    render(
      <Providers>
        <StatusBar />
      </Providers>,
    );
    // The model badge is config-driven (loaded from /ai/models via MSW), not a
    // hardcoded literal — it appears once the model list resolves.
    await waitFor(() =>
      expect(
        screen.getByText(/ollama\/llama3\.2 — lokális/),
      ).toBeInTheDocument(),
    );
  });
});
