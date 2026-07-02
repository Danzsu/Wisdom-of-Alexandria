/**
 * Expand (Bővítés) / Compress (Tömörítés) — the two new dedicated AI writing
 * operations riding the SAME rails as rewrite: selection → action → pending
 * revision card → explicit approve → insert.
 *
 * Mutation-proof focus: the grid actions POST the EXACT `{selected_text,
 * scene_id}` body to the DEDICATED endpoints (`/ai/expand` / `/ai/compress`,
 * NOT `/ai/rewrite`), the pending card renders the revision_type-appropriate
 * label, and Accept approves exactly the returned revision id then replaces
 * exactly the originating selection range.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL, API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import {
  useEditorStore,
  type ApplySuggestionFn,
} from "@/lib/stores/editor-store";
import { AiGenerationProvider } from "../ai-generation-context";
import { AiTab } from "../ai-tab";
import {
  AI_GENERATED_TEXT,
  FAROSZ_BOOK,
  SCENE_ACTIVE,
  makeAiResult,
} from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;
const aiBase = `${AI_BASE_URL}/api/v1`;

vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id }),
  useRouter: () => ({ push: vi.fn() }),
}));

/** Record method+pathname of every outgoing request (routing assertions). */
function recordRequests(): { calls: { method: string; url: string }[] } {
  const calls: { method: string; url: string }[] = [];
  const listener = ({ request }: { request: Request }) => {
    calls.push({ method: request.method, url: new URL(request.url).pathname });
  };
  server.events.on("request:start", listener);
  return { calls };
}

let applySpy: ReturnType<typeof vi.fn<ApplySuggestionFn>>;

const SELECTION = { text: "A rejtett jelek a tekercsen.", from: 5, to: 30 };

function renderAiTab() {
  return render(
    <Providers>
      <AiGenerationProvider>
        <AiTab />
      </AiGenerationProvider>
    </Providers>,
  );
}

describe("Expand / Compress — dedicated endpoints on the rewrite rails", () => {
  beforeEach(() => {
    applySpy = vi.fn<ApplySuggestionFn>();
    useEditorStore.setState({
      activeModel: null,
      inspectorTab: "ai",
      aiSelection: { ...SELECTION },
      applySuggestion: applySpy,
    });
  });
  afterEach(() => {
    server.events.removeAllListeners();
    server.resetHandlers();
  });

  it("Bővítés POSTs the exact {selected_text, scene_id} to /ai/expand — NOT /ai/rewrite", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/expand`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeAiResult("expand", AI_GENERATED_TEXT, "ollama/llama3.2"),
        );
      }),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Bővítés" }));
    await screen.findByText("Bővítés eredménye");

    expect(seenBody).toMatchObject({
      selected_text: SELECTION.text,
      scene_id: SCENE_ACTIVE.id,
    });
    // The dedicated endpoint owns the action — no rewrite POST fired at all.
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/ai/rewrite")),
    ).toBe(false);
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/ai/expand")),
    ).toBe(true);
  });

  it("Tömörítés POSTs the exact {selected_text, scene_id} to /ai/compress — NOT /ai/rewrite", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/compress`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeAiResult("compress", AI_GENERATED_TEXT, "ollama/llama3.2"),
        );
      }),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Tömörítés" }));
    await screen.findByText("Tömörítés eredménye");

    expect(seenBody).toMatchObject({
      selected_text: SELECTION.text,
      scene_id: SCENE_ACTIVE.id,
    });
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/ai/rewrite")),
    ).toBe(false);
    expect(
      calls.some((c) => c.method === "POST" && c.url.endsWith("/ai/compress")),
    ).toBe(true);
  });

  it("the custom instruction rides along as `guidance` (expand)", async () => {
    const user = userEvent.setup();
    let seenBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${aiBase}/ai/expand`, async ({ request }) => {
        seenBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          makeAiResult("expand", AI_GENERATED_TEXT, "ollama/llama3.2"),
        );
      }),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.type(
      screen.getByLabelText("Egyéni utasítás"),
      "több szag és tapintás",
    );
    await user.click(screen.getByRole("button", { name: "Bővítés" }));
    await screen.findByText("Bővítés eredménye");

    expect(seenBody).toMatchObject({ guidance: "több szag és tapintás" });
  });

  it("Accept approves EXACTLY the expand revision id, then replaces the originating range", async () => {
    const user = userEvent.setup();
    const approvedIds: string[] = [];
    server.use(
      http.post(`${aiBase}/ai/expand`, () =>
        HttpResponse.json({
          ...makeAiResult("expand", AI_GENERATED_TEXT, "ollama/llama3.2"),
          revision: {
            ...makeAiResult("expand", AI_GENERATED_TEXT, "ollama/llama3.2")
              .revision,
            id: "rev-expand-fixed",
          },
        }),
      ),
      http.post(`${base}/revisions/:revisionId/approve`, ({ params }) => {
        approvedIds.push(String(params.revisionId));
        return HttpResponse.json({
          id: String(params.revisionId),
          scene_id: SCENE_ACTIVE.id,
          job_id: "job-x",
          content: AI_GENERATED_TEXT,
          approved: true,
          revision_type: "expand",
          model_name: "ollama/llama3.2",
          prompt_version: "1.0",
          created_at: "2026-06-14T16:00:00Z",
          updated_at: "2026-06-14T16:00:00Z",
        });
      }),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Bővítés" }));
    await screen.findByText("Bővítés eredménye");

    // HITL: nothing inserted before the explicit Accept.
    expect(applySpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Elfogad" }));

    await waitFor(() => expect(approvedIds).toEqual(["rev-expand-fixed"]));
    await waitFor(() => expect(applySpy).toHaveBeenCalledTimes(1));
    // The accepted text replaces exactly the originating selection range.
    expect(applySpy).toHaveBeenCalledWith(AI_GENERATED_TEXT, {
      from: SELECTION.from,
      to: SELECTION.to,
    });
  });

  it("compress: Elvet discards without approving or inserting", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Tömörítés" }));
    await screen.findByText("Tömörítés eredménye");

    await user.click(screen.getByRole("button", { name: "Elvet" }));

    await waitFor(() =>
      expect(screen.queryByText("Tömörítés eredménye")).not.toBeInTheDocument(),
    );
    expect(applySpy).not.toHaveBeenCalled();
    expect(
      calls.some((c) => c.method === "POST" && c.url.includes("/approve")),
    ).toBe(false);
  });

  it("blocks expand/compress with no selection (no POST, no insert)", async () => {
    const user = userEvent.setup();
    useEditorStore.setState({ aiSelection: null });
    const { calls } = recordRequests();
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Bővítés" }));
    await user.click(screen.getByRole("button", { name: "Tömörítés" }));

    // Both blocked clicks surface the no-selection toast (one per attempt).
    await waitFor(() =>
      expect(
        screen.getAllByText("Jelölj ki szöveget az AI-művelethez").length,
      ).toBeGreaterThanOrEqual(1),
    );
    expect(
      calls.some(
        (c) =>
          c.method === "POST" &&
          (c.url.endsWith("/ai/expand") || c.url.endsWith("/ai/compress")),
      ),
    ).toBe(false);
    expect(applySpy).not.toHaveBeenCalled();
  });

  it("surfaces an expand error (not swallowed) and renders no result card", async () => {
    const user = userEvent.setup();
    server.use(
      http.post(`${aiBase}/ai/expand`, () =>
        HttpResponse.json({ detail: "AI error: model down" }, { status: 502 }),
      ),
    );
    renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Bővítés" }));

    expect(await screen.findByText(/model down/)).toBeInTheDocument();
    expect(screen.queryByText("Bővítés eredménye")).not.toBeInTheDocument();
  });

  it("has no a11y violations with the compress result card shown", async () => {
    const user = userEvent.setup();
    const { container } = renderAiTab();
    await waitFor(() => expect(screen.getByText("llama3.2")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Tömörítés" }));
    await screen.findByText("Tömörítés eredménye");

    await expectNoA11yViolations(container);
  });
});
