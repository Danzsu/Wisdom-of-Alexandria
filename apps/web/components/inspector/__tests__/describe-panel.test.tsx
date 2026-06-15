import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@/test/msw/server";
import { Providers } from "@/test/test-utils";
import { useEditorStore } from "@/lib/stores/editor-store";
import { DescribePanel } from "../describe-panel";
import { FAROSZ_BOOK, SCENE_ACTIVE } from "@/test/msw/fixtures";

vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id }),
}));

function recordRequests(): { calls: { method: string; url: string }[] } {
  const calls: { method: string; url: string }[] = [];
  server.events.on("request:start", ({ request }) => {
    calls.push({ method: request.method, url: new URL(request.url).pathname });
  });
  return { calls };
}

function renderPanel() {
  return render(
    <Providers>
      <DescribePanel onBack={vi.fn()} />
    </Providers>,
  );
}

describe("Describe panel — 6-channel sensory accordion", () => {
  beforeEach(() => {
    useEditorStore.setState({
      aiSelection: { text: "A rejtett jelek a tekercsen.", from: 5, to: 30 },
    });
  });
  afterEach(() => server.events.removeAllListeners());

  it("renders the 6 channels", () => {
    renderPanel();
    expect(screen.getByText("LÁTÁS")).toBeInTheDocument();
    expect(screen.getByText("HANG")).toBeInTheDocument();
    expect(screen.getByText("TAPINTÁS")).toBeInTheDocument();
    expect(screen.getByText("SZAG")).toBeInTheDocument();
    expect(screen.getByText("ÍZ")).toBeInTheDocument();
    expect(screen.getByText("METAFORA")).toBeInTheDocument();
  });

  it("opening a channel generates alternatives from the real endpoint", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /LÁTÁS/ }));

    // The describe endpoint was hit for this channel and an alternative renders.
    await waitFor(() =>
      expect(
        calls.some((c) => c.method === "POST" && c.url.endsWith("/ai/describe")),
      ).toBe(true),
    );
    expect(
      await screen.findByText(/Látás: érzéki leírás a jelenethez\./),
    ).toBeInTheDocument();
  });

  it("Snippet mentése POSTs a snippet", async () => {
    const user = userEvent.setup();
    const { calls } = recordRequests();
    renderPanel();

    await user.click(screen.getByRole("button", { name: /LÁTÁS/ }));
    await screen.findByText(/Látás: érzéki leírás/);

    await user.click(
      screen.getByRole("button", { name: /Snippet mentése/ }),
    );

    await waitFor(() =>
      expect(
        calls.some(
          (c) => c.method === "POST" && c.url.endsWith("/snippets"),
        ),
      ).toBe(true),
    );
    expect(
      await screen.findByText("Snippetként mentve"),
    ).toBeInTheDocument();
  });

  it("surfaces a channel generation error (not swallowed)", async () => {
    const user = userEvent.setup();
    const { http, HttpResponse } = await import("msw");
    const { AI_BASE_URL } = await import("@/lib/api/client");
    server.use(
      // `/ai/*` lives on the AI service after the Alexandria split.
      http.post(`${AI_BASE_URL}/api/v1/ai/describe`, () =>
        HttpResponse.json({ detail: "AI error: down" }, { status: 502 }),
      ),
    );
    renderPanel();
    await user.click(screen.getByRole("button", { name: /HANG/ }));

    expect(await screen.findByText(/down/)).toBeInTheDocument();
  });
});
