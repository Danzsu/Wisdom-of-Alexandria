/**
 * Ötletelés (brainstorm) — the inspector's idea-generation mode.
 *
 * Mutation-proof focus: the run POSTs the EXACT `{topic, count, scene_id}`
 * body to `/ai/brainstorm`, the returned idea TEXTS render as cards, the
 * per-idea copy button copies the RIGHT idea, star saves it as a Snippet, and
 * NOTHING is ever inserted into the manuscript (no approve, no apply). The
 * panel opens store-driven (`aiPanelView`), which is how the Write page's
 * Ötletelés toolbar action reaches it across the route boundary.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";
import {
  useEditorStore,
  type ApplySuggestionFn,
} from "@/lib/stores/editor-store";
import { AiGenerationProvider } from "../ai-generation-context";
import { AiTab } from "../ai-tab";
import {
  BRAINSTORM_IDEAS_FIXTURE,
  FAROSZ_BOOK,
  SCENE_ACTIVE,
  makeBrainstormResult,
} from "@/test/msw/fixtures";

const aiBase = `${AI_BASE_URL}/api/v1`;

vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id }),
  useRouter: () => ({ push: vi.fn() }),
}));

let applySpy: ReturnType<typeof vi.fn<ApplySuggestionFn>>;

function renderAiTab() {
  return render(
    <Providers>
      <AiGenerationProvider>
        <AiTab />
      </AiGenerationProvider>
    </Providers>,
  );
}

/** Open the panel the way the Write page does: through the store view. */
function openBrainstormViaStore() {
  useEditorStore.setState({ aiPanelView: "brainstorm" });
}

describe("Ötletelés (brainstorm) panel", () => {
  beforeEach(() => {
    applySpy = vi.fn<ApplySuggestionFn>();
    useEditorStore.setState({
      activeModel: null,
      inspectorTab: "ai",
      aiPanelView: "main",
      aiSelection: null,
      applySuggestion: applySpy,
    });
  });
  afterEach(() => {
    server.resetHandlers();
    server.events.removeAllListeners();
  });

  it("opens from the AI tab grid (Ötletelés button)", async () => {
    const user = userEvent.setup();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(
      screen.getByRole("button", { name: hu.inspector.actBrainstorm }),
    );

    expect(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
    ).toBeInTheDocument();
  });

  it("opens store-driven (the Write page's Ötletelés toolbar action)", () => {
    openBrainstormViaStore();
    renderAiTab();
    expect(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
    ).toBeInTheDocument();
  });

  it("prefills the topic from the captured selection", () => {
    useEditorStore.setState({
      aiSelection: { text: "A rejtett jelek a tekercsen.", from: 5, to: 30 },
    });
    openBrainstormViaStore();
    renderAiTab();
    expect(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
    ).toHaveValue("A rejtett jelek a tekercsen.");
  });

  it("run POSTs the EXACT {topic, count, scene_id} and renders the idea TEXTS", async () => {
    const user = userEvent.setup();
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/brainstorm`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeBrainstormResult(BRAINSTORM_IDEAS_FIXTURE.slice(0, 3)),
        );
      }),
    );
    openBrainstormViaStore();
    renderAiTab();

    await user.type(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
      "Mi legyen a fordulat?",
    );
    // Pick a non-default count → the count must ride in the body.
    await user.click(screen.getByRole("button", { name: "3", pressed: false }));
    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormRun }),
    );

    // The three returned idea TEXTS render.
    for (const idea of BRAINSTORM_IDEAS_FIXTURE.slice(0, 3)) {
      expect(await screen.findByText(idea)).toBeInTheDocument();
    }
    expect(seenBody).toMatchObject({
      topic: "Mi legyen a fordulat?",
      count: 3,
      scene_id: SCENE_ACTIVE.id,
    });
    // Ideas are NOT manuscript text: nothing inserted, nothing approved.
    expect(applySpy).not.toHaveBeenCalled();
  });

  it("defaults the count to 5", async () => {
    const user = userEvent.setup();
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/brainstorm`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(makeBrainstormResult());
      }),
    );
    openBrainstormViaStore();
    renderAiTab();

    await user.type(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
      "fordulatok",
    );
    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormRun }),
    );

    await screen.findByText(BRAINSTORM_IDEAS_FIXTURE[0]);
    expect(seenBody).toMatchObject({ count: 5 });
  });

  it("the per-idea copy button copies the RIGHT idea text", async () => {
    const user = userEvent.setup();
    openBrainstormViaStore();
    renderAiTab();

    await user.type(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
      "fordulatok",
    );
    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormRun }),
    );
    await screen.findByText(BRAINSTORM_IDEAS_FIXTURE[0]);

    const copyButtons = screen.getAllByRole("button", {
      name: hu.inspector.brainstormCopy,
    });
    expect(copyButtons).toHaveLength(BRAINSTORM_IDEAS_FIXTURE.length);

    // Copy the THIRD idea — exactly that text must reach the clipboard.
    // (`userEvent.setup()` installs a working clipboard stub; read it back.)
    await user.click(copyButtons[2]);
    expect(
      await screen.findByText(hu.write.toastCopied),
    ).toBeInTheDocument();
    await expect(navigator.clipboard.readText()).resolves.toBe(
      BRAINSTORM_IDEAS_FIXTURE[2],
    );
  });

  it("star saves the idea as a Snippet (POST /snippets) — never inserts", async () => {
    const user = userEvent.setup();
    const snippetBodies: Record<string, unknown>[] = [];
    server.use(
      http.post(
        `*/projects/:projectId/snippets`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          snippetBodies.push(body);
          return HttpResponse.json(
            {
              id: "snippet-idea",
              project_id: "p",
              title: String(body.title ?? ""),
              content: String(body.content ?? ""),
              source_scene_id: SCENE_ACTIVE.id,
              tags: [],
              created_at: "2026-06-14T16:00:00Z",
              updated_at: "2026-06-14T16:00:00Z",
            },
            { status: 201 },
          );
        },
      ),
    );
    openBrainstormViaStore();
    renderAiTab();

    await user.type(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
      "fordulatok",
    );
    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormRun }),
    );
    await screen.findByText(BRAINSTORM_IDEAS_FIXTURE[0]);

    const starButtons = screen.getAllByRole("button", {
      name: hu.inspector.saveSnippet,
    });
    await user.click(starButtons[1]);

    await waitFor(() => expect(snippetBodies).toHaveLength(1));
    expect(snippetBodies[0]).toMatchObject({
      content: BRAINSTORM_IDEAS_FIXTURE[1],
      source_scene_id: SCENE_ACTIVE.id,
    });
    expect(applySpy).not.toHaveBeenCalled();
  });

  it("shows the generating treatment while the request is in flight", async () => {
    const user = userEvent.setup();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${aiBase}/ai/brainstorm`, async () => {
        await gate;
        return HttpResponse.json(makeBrainstormResult());
      }),
    );
    openBrainstormViaStore();
    renderAiTab();

    await user.type(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
      "fordulatok",
    );
    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormRun }),
    );

    expect(
      await screen.findByText("Generálás folyamatban…"),
    ).toBeInTheDocument();
    release();
    await screen.findByText(BRAINSTORM_IDEAS_FIXTURE[0]);
  });

  it("surfaces a brainstorm error as a toast (never swallowed)", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${aiBase}/ai/brainstorm`, () =>
        HttpResponse.json({ detail: "AI error: model down" }, { status: 502 }),
      ),
    );
    openBrainstormViaStore();
    renderAiTab();

    await user.type(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
      "fordulatok",
    );
    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormRun }),
    );

    expect(await screen.findByText(/model down/)).toBeInTheDocument();
    // No idea cards on error.
    expect(
      screen.queryByText(BRAINSTORM_IDEAS_FIXTURE[0]),
    ).not.toBeInTheDocument();
  });

  it("blocks a run with a blank topic (no POST)", async () => {
    const user = userEvent.setup();
    const posts: string[] = [];
    const listener = ({ request }: { request: Request }) => {
      if (request.method === "POST") posts.push(new URL(request.url).pathname);
    };
    server.events.on("request:start", listener);
    openBrainstormViaStore();
    renderAiTab();

    const run = screen.getByRole("button", {
      name: hu.inspector.brainstormRun,
    });
    expect(run).toBeDisabled();
    await user.click(run);
    expect(posts.filter((p) => p.endsWith("/ai/brainstorm"))).toHaveLength(0);
  });

  it("the back button returns to the main AI grid", async () => {
    const user = userEvent.setup();
    openBrainstormViaStore();
    renderAiTab();

    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormBackAria }),
    );

    // The main grid is back (the Átírás action is its landmark).
    expect(screen.getByRole("button", { name: "Átírás" })).toBeInTheDocument();
  });

  it("has no a11y violations with ideas rendered", async () => {
    const user = userEvent.setup();
    openBrainstormViaStore();
    const { container } = renderAiTab();

    await user.type(
      screen.getByLabelText(hu.inspector.brainstormTopicAria),
      "fordulatok",
    );
    await user.click(
      screen.getByRole("button", { name: hu.inspector.brainstormRun }),
    );
    await screen.findByText(BRAINSTORM_IDEAS_FIXTURE[0]);

    await expectNoA11yViolations(container);
  });
});
