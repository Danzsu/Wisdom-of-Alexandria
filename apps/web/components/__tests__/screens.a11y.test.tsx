/**
 * Automated accessibility (axe-core) gate for the key screens / regions (UX-4b).
 *
 * Each test mounts a real surface through the test Providers + MSW (so data and
 * portalled overlays are present), waits for content, then asserts axe finds NO
 * violations. Overlays opened via the UI store (command palette, shortcuts) and
 * Radix portals are scanned at the `document` level.
 *
 * Rule config (color-contrast off under jsdom; page-level `region` off only for
 * bare portalled overlays) lives in `test/a11y.ts`.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { expectNoA11yViolations } from "@/test/a11y";
import { Providers } from "@/test/test-utils";
import {
  FAROSZ_BOOK,
  FAROSZ_PROJECT,
  FAROSZ_CODEX,
  SCENE_ACTIVE,
} from "@/test/msw/fixtures";

const push = vi.fn();
let pathname = "/konyv/demo/terv";
const params: Record<string, string | undefined> = {
  bookId: FAROSZ_BOOK.id,
  sceneId: SCENE_ACTIVE.id,
};

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, prefetch: vi.fn(), replace: vi.fn() }),
  usePathname: () => pathname,
  useParams: () => params,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light", setTheme: vi.fn() }),
}));

import { ProjectsDashboard } from "@/components/projects/projects-dashboard";
import { InspectorPanel } from "@/components/inspector/inspector-panel";
import { AiGenerationProvider } from "@/components/inspector/ai-generation-context";
import { DescribePanel } from "@/components/inspector/describe-panel";
import { NewRelationModal } from "@/components/relations/new-relation-modal";
import { AiToolbar } from "@/components/editor/ai-toolbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { ShortcutsOverlay } from "@/components/shell/shortcuts-overlay";
import { RelationsScreen } from "@/components/relations/relations-screen";
import { TimelineScreen } from "@/components/timeline/timeline-screen";
import { useUIStore } from "@/lib/stores/ui-store";
import { useEditorStore } from "@/lib/stores/editor-store";

describe("a11y: screens & regions", () => {
  beforeEach(() => {
    push.mockClear();
    pathname = "/konyv/demo/terv";
    useUIStore.setState({
      openMenu: null,
      commandOpen: false,
      shortcutsOpen: false,
      sparkActive: false,
      howItWorksOpen: false,
    });
  });

  it("ProjectsDashboard — loaded list of projects", async () => {
    const { container } = render(
      <Providers>
        <ProjectsDashboard />
      </Providers>,
    );
    await waitFor(() =>
      expect(
        screen.getAllByText("A Fárosz őrzője").length,
      ).toBeGreaterThan(0),
    );
    await expectNoA11yViolations(container);
  });

  it("InspectorPanel — AI assistant tabs", async () => {
    useEditorStore.setState({ inspectorTab: "ai", aiSelection: null });
    const { container } = render(
      <Providers>
        <AiGenerationProvider>
          <InspectorPanel />
        </AiGenerationProvider>
      </Providers>,
    );
    await screen.findByRole("tablist", { name: "AI segéd panelek" });
    await expectNoA11yViolations(container);
  });

  it("DescribePanel — 6-channel sensory accordion", async () => {
    useEditorStore.setState({
      aiSelection: { text: "A rejtett jelek a tekercsen.", from: 5, to: 30 },
    });
    const { container } = render(
      <Providers>
        <DescribePanel onBack={vi.fn()} />
      </Providers>,
    );
    await screen.findByText("LÁTÁS");
    await expectNoA11yViolations(container);
  });

  it("NewRelationModal (open) — labelled relation form dialog", async () => {
    render(
      <Providers>
        <NewRelationModal
          open
          onOpenChange={() => {}}
          projectId={FAROSZ_PROJECT.id}
          entries={FAROSZ_CODEX}
        />
      </Providers>,
    );
    await screen.findByRole("dialog");
    await expectNoA11yViolations(document);
  });

  it("AiToolbar — editor AI toolbar", async () => {
    useEditorStore.setState({
      msFont: "Literata",
      fmSize: 17,
      msWidth: "normal",
      fmSpacing: "1.75",
      focusOn: false,
      wordCount: 1482,
      saveState: "saved",
    });
    const { container } = render(
      <Providers>
        <AiToolbar editor={null} onAction={vi.fn()} />
      </Providers>,
    );
    await screen.findByRole("button", { name: /Írás/ });
    await expectNoA11yViolations(container);
  });

  it("CommandPalette (open) — searchable command list", async () => {
    render(
      <Providers>
        <CommandPalette />
      </Providers>,
    );
    useUIStore.getState().openCommand();
    await screen.findByRole("dialog");
    await expectNoA11yViolations(document);
  });

  it("ShortcutsOverlay (open) — keyboard shortcuts dialog", async () => {
    render(
      <Providers>
        <ShortcutsOverlay />
      </Providers>,
    );
    useUIStore.getState().openShortcuts();
    await screen.findByRole("dialog");
    await expectNoA11yViolations(document);
  });

  it("RelationsScreen — relationship graph with relations", async () => {
    const { container } = render(
      <Providers>
        <RelationsScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(screen.getByText("Szelene")).toBeInTheDocument(),
    );
    await expectNoA11yViolations(container);
  });

  it("TimelineScreen — chapter/scene timeline", async () => {
    const { container } = render(
      <Providers>
        <TimelineScreen bookId={FAROSZ_BOOK.id} />
      </Providers>,
    );
    await waitFor(() =>
      expect(
        screen.getAllByText(/jelenet|szó|Első fejezet/i).length,
      ).toBeGreaterThan(0),
    );
    await expectNoA11yViolations(container);
  });
});
