import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { InspectorScene } from "../use-inspector-scene";

// Drive the MetaTab purely through the inspector-scene hook so we can force the
// tree-load-failure state without standing up the whole book tree + MSW.
const sceneState: { value: InspectorScene } = {
  value: {
    scene: null,
    chapter: null,
    bookId: "b1",
    sceneId: "s1",
    isLoading: false,
    isError: false,
  },
};

vi.mock("../use-inspector-scene", () => ({
  useInspectorScene: () => sceneState.value,
}));

import { MetaTab } from "../meta-tab";

describe("MetaTab — tree error", () => {
  it("renders the error branch (role=alert) instead of silent '—' on tree failure", () => {
    sceneState.value = {
      scene: null,
      chapter: null,
      bookId: "b1",
      sceneId: "s1",
      isLoading: false,
      isError: true,
    };

    render(<MetaTab />);

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveTextContent("Nem sikerült betölteni a fejezeteket");
    // The metadata table (e.g. the Státusz row label) must NOT be rendered.
    expect(screen.queryByText("Státusz")).not.toBeInTheDocument();
  });

  it("renders the metadata table when the tree loaded (no error)", () => {
    sceneState.value = {
      scene: {
        id: "s1",
        status: "draft",
        word_count: 0,
        updated_at: "2026-06-15T10:00:00Z",
      } as InspectorScene["scene"],
      chapter: null,
      bookId: "b1",
      sceneId: "s1",
      isLoading: false,
      isError: false,
    };

    render(<MetaTab />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Státusz")).toBeInTheDocument();
  });
});
