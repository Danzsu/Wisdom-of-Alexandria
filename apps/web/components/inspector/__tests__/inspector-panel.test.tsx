import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/test-utils";
import { useEditorStore } from "@/lib/stores/editor-store";
import { InspectorPanel } from "../inspector-panel";
import { AiGenerationProvider } from "../ai-generation-context";
import { FAROSZ_BOOK, SCENE_ACTIVE } from "@/test/msw/fixtures";

vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id }),
  useRouter: () => ({ push: vi.fn() }),
}));

function renderPanel() {
  return render(
    <Providers>
      <AiGenerationProvider>
        <InspectorPanel />
      </AiGenerationProvider>
    </Providers>,
  );
}

describe("InspectorPanel — tabs", () => {
  beforeEach(() => {
    useEditorStore.setState({ inspectorTab: "ai", aiSelection: null });
  });

  it("renders the five vertical tabs", () => {
    renderPanel();
    const tablist = screen.getByRole("tablist", { name: "AI segéd panelek" });
    expect(tablist).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "AI" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Codex" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Beatek" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Figyelm." })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Meta" })).toBeInTheDocument();
  });

  it("Meta tab shows scene metadata from real data", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("tab", { name: "Meta" }));

    expect(screen.getByText("Jelenet metaadatok")).toBeInTheDocument();
    // The active scene's status + word count appear once the tree resolves.
    await waitFor(() =>
      expect(screen.getByText(SCENE_ACTIVE.status)).toBeInTheDocument(),
    );
    expect(screen.getByText(String(SCENE_ACTIVE.word_count))).toBeInTheDocument();
  });

  it("Warnings tab renders an honest M10 empty state (no fake engine)", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("tab", { name: "Figyelm." }));

    expect(
      screen.getByText("Nincs folytonossági figyelmeztetés"),
    ).toBeInTheDocument();
    expect(screen.getByText(/M10-ben érkezik/)).toBeInTheDocument();
  });

  it("Beatek tab lists the scene's beats from the real endpoint", async () => {
    const user = userEvent.setup();
    renderPanel();
    await user.click(screen.getByRole("tab", { name: "Beatek" }));

    expect(
      await screen.findByText(
        "Szelene felfedezi a rejtett jeleket a tekercsen.",
      ),
    ).toBeInTheDocument();
  });
});
