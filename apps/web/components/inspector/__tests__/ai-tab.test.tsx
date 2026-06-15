import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  useEditorStore,
  type ApplySuggestionFn,
} from "@/lib/stores/editor-store";
import { AiGenerationProvider } from "../ai-generation-context";
import { AiTab } from "../ai-tab";
import { FAROSZ_BOOK, SCENE_ACTIVE, AI_GENERATED_TEXT } from "@/test/msw/fixtures";

/** Domain base — `/revisions/*` (the human-in-the-loop approve) stays here. */
const base = `${API_BASE_URL}/api/v1`;
/** AI service base — `/ai/*` generation calls live here after the split. */
const aiBase = `${AI_BASE_URL}/api/v1`;

vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id }),
  useRouter: () => ({ push: vi.fn() }),
}));

/** Record the method+path of every outgoing request for human-in-the-loop assertions. */
function recordRequests(): { calls: { method: string; url: string }[] } {
  const calls: { method: string; url: string }[] = [];
  const listener = ({ request }: { request: Request }) => {
    calls.push({ method: request.method, url: new URL(request.url).pathname });
  };
  server.events.on("request:start", listener);
  return { calls };
}

/** A spy editor bridge so we can assert insertion happens ONLY after Accept. */
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

describe("AI Inspector tab — human-in-the-loop flow", () => {
  beforeEach(() => {
    applySpy = vi.fn<ApplySuggestionFn>();
    useEditorStore.setState({
      activeModel: null,
      inspectorTab: "ai",
      // A selection is present so rewrite-family actions can run.
      aiSelection: { text: "A rejtett jelek a tekercsen.", from: 5, to: 30 },
      applySuggestion: applySpy,
    });
  });
  afterEach(() => {
    server.events.removeAllListeners();
  });

  it("lists real (mocked) models — not hardcoded", async () => {
    renderAiTab();
    // The selector trigger shows the config-driven model label once loaded.
    await waitFor(() =>
      expect(screen.getByText("llama3.2")).toBeInTheDocument(),
    );
  });

  it("action grid → GeneratingCard → AIResultCard with model + version", async () => {
    const user = userEvent.setup();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));

    // The result card shows the action label, the model chip and the version.
    expect(
      await screen.findByText("Átírás eredménye"),
    ).toBeInTheDocument();
    expect(screen.getByText(AI_GENERATED_TEXT)).toBeInTheDocument();
    // Model chip (config-driven) + prompt version badge from the revision.
    expect(screen.getByText("ollama/llama3.2")).toBeInTheDocument();
    expect(screen.getByText("1.0")).toBeInTheDocument();
  });

  it("does NOT insert before Accept; Elfogad approves the revision THEN inserts", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));
    await screen.findByText("Átírás eredménye");

    // Human-in-the-loop: nothing inserted, no approve POST yet.
    expect(applySpy).not.toHaveBeenCalled();
    expect(
      calls.some((c) => c.method === "POST" && c.url.includes("/approve")),
    ).toBe(false);

    await user.click(screen.getByRole("button", { name: "Elfogad" }));

    // Approve POSTed, THEN the editor bridge was called with the accepted text.
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "POST" && c.url.includes("/approve")),
      ).toBe(true),
    );
    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(1));
    expect(applySpy).toHaveBeenCalledWith(AI_GENERATED_TEXT, {
      from: 5,
      to: 30,
    });
    // Saved toast + card dismissed.
    expect(await screen.findByText("Új revízióként mentve")).toBeInTheDocument();
  });

  it("disables Elfogad while the approve is pending — a double-click fires one approve + one insert", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    // Gate the approve response so the pending state is observable across two clicks.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${base}/revisions/:revisionId/approve`, async ({ params }) => {
        await gate;
        return HttpResponse.json({
          id: String(params.revisionId),
          scene_id: SCENE_ACTIVE.id,
          job_id: "job-approve",
          content: AI_GENERATED_TEXT,
          approved: true,
          revision_type: "rewrite",
          model_name: "ollama/llama3.2",
          prompt_version: "1.0",
          created_at: "2026-06-14T16:00:00Z",
          updated_at: "2026-06-14T16:00:00Z",
        });
      }),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));
    await screen.findByText("Átírás eredménye");

    const accept = screen.getByRole("button", { name: "Elfogad" });
    // First click starts the approve (now in flight); the button becomes disabled.
    await user.click(accept);
    await waitFor(() => expect(accept).toBeDisabled());
    // A determined double-click while pending must not fire a second approve.
    await user.click(accept);

    // Release the gated approve → it resolves once, inserts once.
    release();
    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(1));
    const approveCalls = calls.filter(
      (c) => c.method === "POST" && c.url.includes("/approve"),
    );
    expect(approveCalls).toHaveLength(1);
  });

  it("Elvet discards without inserting or approving", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));
    await screen.findByText("Átírás eredménye");

    await user.click(screen.getByRole("button", { name: "Elvet" }));

    // The card is gone, nothing inserted, no approve POST.
    await waitFor(() =>
      expect(screen.queryByText("Átírás eredménye")).not.toBeInTheDocument(),
    );
    expect(applySpy).not.toHaveBeenCalled();
    expect(
      calls.some((c) => c.method === "POST" && c.url.includes("/approve")),
    ).toBe(false);
  });

  it("Star saves the result as a Snippet (POST)", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));
    await screen.findByText("Átírás eredménye");

    await user.click(
      screen.getByRole("button", { name: "Mentés Snippetként" }),
    );

    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "POST" && c.url.endsWith("/snippets")),
      ).toBe(true),
    );
    expect(await screen.findByText("Snippetként mentve")).toBeInTheDocument();
    // The Star action does NOT insert into the manuscript.
    expect(applySpy).not.toHaveBeenCalled();
  });

  it("shows the GeneratingCard while the request is in flight", async () => {
    const user = userEvent.setup();
    // Delay the rewrite response so the loading state is observable.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.post(`${aiBase}/ai/rewrite`, async () => {
        await gate;
        return HttpResponse.json({
          revision: {
            id: "rev-delayed",
            scene_id: SCENE_ACTIVE.id,
            job_id: "job-delayed",
            content: AI_GENERATED_TEXT,
            approved: false,
            revision_type: "rewrite",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            created_at: "2026-06-14T16:00:00Z",
            updated_at: "2026-06-14T16:00:00Z",
          },
          job: {
            id: "job-delayed",
            scene_id: SCENE_ACTIVE.id,
            chapter_id: null,
            job_type: "rewrite",
            status: "done",
            model_name: "ollama/llama3.2",
            prompt_version: "1.0",
            input_data: {},
            output_data: {},
            error_message: null,
            created_at: "2026-06-14T16:00:00Z",
            updated_at: "2026-06-14T16:00:00Z",
          },
        });
      }),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));
    // The generating status appears before the (gated) response resolves.
    expect(
      await screen.findByText("Generálás folyamatban…"),
    ).toBeInTheDocument();
    // Release the response → it resolves to the result card.
    release();
    await screen.findByText("Átírás eredménye");
  });

  it("surfaces a generation error (not swallowed)", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${aiBase}/ai/rewrite`, () =>
        HttpResponse.json({ detail: "AI error: model down" }, { status: 502 }),
      ),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));

    expect(
      await screen.findByText(/model down/),
    ).toBeInTheDocument();
    // No result card on error.
    expect(screen.queryByText("Átírás eredménye")).not.toBeInTheDocument();
  });

  it("blocks the action with no selection (no auto-write)", async () => {
    const user = userEvent.setup();
    useEditorStore.setState({ aiSelection: null });
    const { calls } = recordRequests();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Átírás" }));

    // No rewrite POST fired; nothing inserted.
    await waitFor(() =>
      expect(
        screen.getByText("Jelölj ki szöveget az AI-művelethez"),
      ).toBeInTheDocument(),
    );
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/ai/rewrite")),
    ).toBe(false);
    expect(applySpy).not.toHaveBeenCalled();
  });
});
