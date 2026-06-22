import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import {
  resetImageStore,
  resetCodexStore,
} from "@/test/msw/handlers";
import { FAROSZ_PROJECT, makeMediaAsset } from "@/test/msw/fixtures";
import { ImagePanel } from "@/components/codex/image-panel";
import { hu } from "@/lib/i18n/hu";
import type { CodexEntryRead } from "@/lib/api/types";

const aiBase = `${AI_BASE_URL}/api/v1`;

const SZELENE: CodexEntryRead = {
  id: "codex-szelene",
  project_id: FAROSZ_PROJECT.id,
  series_id: null,
  title: "Szelene",
  entry_type: "character",
  content: "A Nagykönyvtár éjszakai írnoka.",
  aliases: ["Lené"],
  role: "Protagonista",
  ai_visible: true,
  tags: [],
  created_at: "2026-06-14T14:32:00Z",
  updated_at: "2026-06-14T14:32:00Z",
};

function renderPanel(entry: CodexEntryRead = SZELENE) {
  return renderWithProviders(<ImagePanel entry={entry} />);
}

describe("ImagePanel", () => {
  beforeEach(() => {
    resetImageStore();
    resetCodexStore();
  });
  afterEach(() => server.events.removeAllListeners());

  it("shows the style picker (from the styles handler) and the Generate button", async () => {
    renderPanel();
    const picker = await screen.findByLabelText(hu.images.styleLabel);
    // Options come from IMAGE_STYLES_FIXTURE for entity_type=character.
    await waitFor(() =>
      expect(within(picker).getByText("Realisztikus portré")).toBeInTheDocument(),
    );
    expect(within(picker).getByText("Festői portré")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: hu.images.generate }),
    ).toBeInTheDocument();
  });

  it("empty state when the entity has no images", async () => {
    renderPanel();
    expect(await screen.findByText(hu.images.empty)).toBeInTheDocument();
  });

  it("clicking Generate POSTs and a generating tile then a ready thumbnail appears", async () => {
    const user = userEvent.setup();
    // GET returns generating first, then ready — mirror the poll test.
    let calls = 0;
    server.use(
      http.get(`${aiBase}/ai/images`, () => {
        calls += 1;
        if (calls === 0) return HttpResponse.json([]);
        const status = calls < 2 ? "generating" : "ready";
        return HttpResponse.json([makeMediaAsset(status, { id: "media-poll" })]);
      }),
    );

    renderPanel();
    const button = await screen.findByRole("button", {
      name: hu.images.generate,
    });
    await user.click(button);

    // Eventually a ready thumbnail <img> appears (poll flips generating→ready).
    await waitFor(
      () => expect(screen.getByRole("img")).toBeInTheDocument(),
      { timeout: 5000 },
    );
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  it("shows the canonical badge and offers set-canonical on a non-canonical asset", async () => {
    const user = userEvent.setup();
    const canonicalCalls: string[] = [];
    server.use(
      http.get(`${aiBase}/ai/images`, () =>
        HttpResponse.json([
          makeMediaAsset("ready", { id: "media-canon", is_canonical: true }),
          makeMediaAsset("ready", { id: "media-other", is_canonical: false }),
        ]),
      ),
      http.post(`${aiBase}/ai/images/:assetId/canonical`, ({ params }) => {
        canonicalCalls.push(String(params.assetId));
        return HttpResponse.json(
          makeMediaAsset("ready", {
            id: String(params.assetId),
            is_canonical: true,
          }),
        );
      }),
    );

    renderPanel();
    expect(
      await screen.findByText(hu.images.canonicalBadge),
    ).toBeInTheDocument();

    // The non-canonical asset has a "set canonical" action.
    const setButtons = await screen.findAllByRole("button", {
      name: hu.images.setCanonical,
    });
    expect(setButtons).toHaveLength(1);
    await user.click(setButtons[0]);
    await waitFor(() => expect(canonicalCalls).toContain("media-other"));
  });

  it("delete calls the delete endpoint", async () => {
    const user = userEvent.setup();
    const deleted: string[] = [];
    server.use(
      http.get(`${aiBase}/ai/images`, () =>
        HttpResponse.json([
          makeMediaAsset("ready", { id: "media-del", is_canonical: false }),
        ]),
      ),
      http.delete(`${aiBase}/ai/images/:assetId`, ({ params }) => {
        deleted.push(String(params.assetId));
        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderPanel();
    const del = await screen.findByRole("button", { name: hu.images.delete });
    await user.click(del);

    // ConfirmDialog → confirm.
    const confirm = await screen.findByRole("button", {
      name: hu.kit.confirmDelete,
    });
    await user.click(confirm);

    await waitFor(() => expect(deleted).toContain("media-del"));
  });

  it("surfaces the load error (role=status)", async () => {
    server.use(
      http.get(`${aiBase}/ai/images`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderPanel();
    expect(await screen.findByText(hu.images.loadError)).toBeInTheDocument();
  });

  it("shows the failed chip for a failed asset", async () => {
    server.use(
      http.get(`${aiBase}/ai/images`, () =>
        HttpResponse.json([
          makeMediaAsset("failed", { id: "media-fail", width: null, height: null }),
        ]),
      ),
    );
    renderPanel();
    expect(await screen.findByText(hu.images.failedChip)).toBeInTheDocument();
  });
});
