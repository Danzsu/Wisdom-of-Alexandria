import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { hu } from "@/lib/i18n/hu";
import { FAROSZ_BOOK, SCENE_ACTIVE } from "@/test/msw/fixtures";
import { WarningsTab } from "../warnings-tab";

const aiBase = `${AI_BASE_URL}/api/v1`;

/** Default: a scene IS open, so the check can run. Overridden per-test below. */
let mockParams: Record<string, string | undefined> = {
  bookId: FAROSZ_BOOK.id,
  sceneId: SCENE_ACTIVE.id,
};

vi.mock("next/navigation", () => ({
  useParams: () => mockParams,
  useRouter: () => ({ push: vi.fn() }),
}));

function renderWarningsTab() {
  return render(
    <Providers>
      <WarningsTab />
    </Providers>,
  );
}

describe("WarningsTab — continuity check (B3)", () => {
  beforeEach(() => {
    mockParams = { bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id };
  });
  afterEach(() => {
    server.resetHandlers();
  });

  it("keeps the Folytonosság header", () => {
    renderWarningsTab();
    expect(screen.getByText(hu.inspector.warningsLabel)).toBeInTheDocument();
  });

  it("shows the idle prompt + a check button before any check", () => {
    renderWarningsTab();
    expect(
      screen.getByRole("button", { name: hu.inspector.warningsCheck }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(hu.inspector.warningsIdleHint),
    ).toBeInTheDocument();
  });

  it("renders warnings with mixed severities + an entity chip", async () => {
    const user = userEvent.setup();
    renderWarningsTab();

    await user.click(
      screen.getByRole("button", { name: hu.inspector.warningsCheck }),
    );

    // Both fixture messages render.
    expect(
      await screen.findByText("Szelene a 2. fejezetben elutazik, de itt jelen van."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A jelenet napszaka nincs megadva."),
    ).toBeInTheDocument();

    // The severity labels appear (error + warning at least).
    expect(screen.getByText(hu.inspector.warningsSeverity.error)).toBeInTheDocument();
    expect(
      screen.getAllByText(hu.inspector.warningsSeverity.warning).length,
    ).toBeGreaterThanOrEqual(1);

    // The entity chip surfaces for the warning that has one.
    expect(screen.getByText("Szelene")).toBeInTheDocument();

    // Result heading shows the count.
    expect(screen.getByText(hu.inspector.warningsFound(2))).toBeInTheDocument();
  });

  it("shows the positive no-issues state when warnings is empty", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${aiBase}/ai/continuity`, () =>
        HttpResponse.json({ warnings: [], context_entities: [] }),
      ),
    );
    renderWarningsTab();

    await user.click(
      screen.getByRole("button", { name: hu.inspector.warningsCheck }),
    );

    expect(
      await screen.findByText(hu.inspector.warningsNoIssuesTitle),
    ).toBeInTheDocument();
  });

  it("shows a loading state while the check is in flight", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${aiBase}/ai/continuity`, async () => {
        await gate;
        return HttpResponse.json({ warnings: [], context_entities: [] });
      }),
    );
    renderWarningsTab();

    await user.click(
      screen.getByRole("button", { name: hu.inspector.warningsCheck }),
    );
    // The button switches to the in-flight label and is disabled while pending.
    const checkingButton = await screen.findByRole("button", {
      name: hu.inspector.warningsChecking,
    });
    expect(checkingButton).toBeDisabled();

    release();
    await screen.findByText(hu.inspector.warningsNoIssuesTitle);
  });

  it("surfaces an error (not swallowed)", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${aiBase}/ai/continuity`, () =>
        HttpResponse.json(
          { detail: "AI generation failed: model down" },
          { status: 502 },
        ),
      ),
    );
    renderWarningsTab();

    await user.click(
      screen.getByRole("button", { name: hu.inspector.warningsCheck }),
    );

    expect(await screen.findByText(/model down/)).toBeInTheDocument();
    expect(screen.getByText(hu.inspector.warningsError)).toBeInTheDocument();
  });

  it("does not crash on a malformed warning (defensive severity fallback)", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${aiBase}/ai/continuity`, () =>
        HttpResponse.json({
          // Unknown severity + null entity — the tolerant schema parses it and
          // the UI must render it without crashing.
          warnings: [
            { severity: "totally_unknown", message: "Ismeretlen súlyosság.", entity: null },
          ],
          context_entities: [],
        }),
      ),
    );
    renderWarningsTab();

    await user.click(
      screen.getByRole("button", { name: hu.inspector.warningsCheck }),
    );

    expect(
      await screen.findByText("Ismeretlen súlyosság."),
    ).toBeInTheDocument();
  });

  it("shows a no-scene state when no scene is open (button absent)", () => {
    mockParams = { bookId: FAROSZ_BOOK.id, sceneId: undefined };
    renderWarningsTab();
    expect(screen.getByText(hu.inspector.warningsNoScene)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: hu.inspector.warningsCheck }),
    ).not.toBeInTheDocument();
  });
});
