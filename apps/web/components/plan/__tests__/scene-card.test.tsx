/**
 * SceneCard FM mount-stagger guard (UX-2a). The card carries a SHORT mount
 * fade-up on an OUTER wrapper while the inner dnd-kit node keeps the drag
 * transform — they must live on separate elements so FM and dnd-kit never fight
 * over `transform`. We mock `useSortable` so the card renders without a real dnd
 * runtime and assert: (1) every card's content renders, (2) reduced motion still
 * shows content, (3) the dnd transform lands on the card node (not clobbered).
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { PlanScene } from "../types";

const sortableState = {
  transform: null as { x: number; y: number; scaleX: number; scaleY: number } | null,
  isDragging: false,
};

vi.mock("@dnd-kit/sortable", () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    setActivatorNodeRef: vi.fn(),
    transform: sortableState.transform,
    transition: undefined,
    isDragging: sortableState.isDragging,
    isOver: false,
  }),
}));

import { SceneCard } from "../scene-card";

function makeScene(id: string, title: string): PlanScene {
  return {
    id,
    chapterId: "ch1",
    index: 1,
    title,
    summary: "Egy nyugodt jelenet.",
    status: "draft",
    pov: [],
    raw: {} as PlanScene["raw"],
  };
}

const noop = () => {};

function renderCard(scene: PlanScene, index = 0) {
  return render(
    <SceneCard
      scene={scene}
      index={index}
      density="default"
      bookId={undefined}
      onOpen={noop}
      onChangePov={noop}
      onDuplicate={noop}
      onArchive={noop}
      onDelete={noop}
    />,
  );
}

/** Force framer-motion's reduced-motion preference on via matchMedia. */
function withReducedMotion(fn: () => void) {
  const original = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    matches: query.includes("reduce"),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
  try {
    fn();
  } finally {
    window.matchMedia = original;
  }
}

describe("SceneCard mount animation", () => {
  it("renders every card's content (stagger never drops items)", () => {
    sortableState.transform = null;
    sortableState.isDragging = false;
    renderCard(makeScene("s1", "Első jelenet"), 0);
    renderCard(makeScene("s2", "Második jelenet"), 1);
    renderCard(makeScene("s3", "Harmadik jelenet"), 99);

    expect(screen.getByText("Első jelenet")).toBeInTheDocument();
    expect(screen.getByText("Második jelenet")).toBeInTheDocument();
    expect(screen.getByText("Harmadik jelenet")).toBeInTheDocument();
  });

  it("renders content immediately under reduced motion", () => {
    sortableState.transform = null;
    sortableState.isDragging = false;
    withReducedMotion(() => {
      renderCard(makeScene("s1", "Csendes jelenet"));
      expect(screen.getByText("Csendes jelenet")).toBeInTheDocument();
      expect(screen.getByText("Egy nyugodt jelenet.")).toBeInTheDocument();
    });
  });

  it("keeps the dnd-kit drag transform on the card node (not fought by FM)", () => {
    sortableState.transform = { x: 0, y: 12, scaleX: 1, scaleY: 1 };
    sortableState.isDragging = true;
    renderCard(makeScene("s1", "Húzott jelenet"));

    // The card node (the element with the card classes) carries dnd-kit's
    // translate3d; the FM wrapper above it owns the mount fade-up separately.
    const title = screen.getByText("Húzott jelenet");
    const cardNode = title.closest("div.rounded-xl") as HTMLElement;
    expect(cardNode).not.toBeNull();
    expect(cardNode.style.transform).toContain("translate3d");
    // Design drag polish: the tilt is COMPOSED into the same inline transform
    // (dnd-kit's pointer-follow keeps working) and the fade moved from an
    // inline opacity to the `.woa-dragging` class (opacity .4 in globals.css)
    // — an inline value would override the class, so none may remain.
    expect(cardNode.style.transform).toContain("scale(0.97) rotate(-1.4deg)");
    expect(cardNode.classList.contains("woa-dragging")).toBe(true);
    expect(cardNode.style.opacity).toBe("");
  });
});
