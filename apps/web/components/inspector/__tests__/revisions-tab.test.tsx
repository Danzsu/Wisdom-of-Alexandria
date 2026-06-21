import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { RevisionsTab } from "../revisions-tab";
import { FAROSZ_BOOK, SCENE_ACTIVE } from "@/test/msw/fixtures";
import { hu } from "@/lib/i18n/hu";

const base = `${API_BASE_URL}/api/v1`;

// The inspector reads the active scene from the route; point it at a real
// fixture scene so use-inspector-scene resolves content from the book tree.
vi.mock("next/navigation", () => ({
  useParams: () => ({ bookId: FAROSZ_BOOK.id, sceneId: SCENE_ACTIVE.id }),
}));

describe("RevisionsTab", () => {
  afterEach(() => server.resetHandlers());

  it("lists the scene's revisions with diff + restore/reject actions", async () => {
    renderWithProviders(<RevisionsTab />);
    // Two revisions from the default handler → two Restore buttons + the diff
    // "current" label rendered by DiffPane.
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: hu.revisions.restore }).length,
      ).toBe(2),
    );
    expect(screen.getAllByText(hu.revisions.currentLabel).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: hu.revisions.reject }).length,
    ).toBe(2);
  });

  it("Restore calls the approve endpoint", async () => {
    const approves: string[] = [];
    server.use(
      http.post(`${base}/revisions/:id/approve`, ({ params }) => {
        approves.push(String(params.id));
        return HttpResponse.json({
          id: String(params.id),
          scene_id: SCENE_ACTIVE.id,
          job_id: null,
          content: "visszaállítva",
          approved: true,
          revision_type: "rewrite",
          model_name: null,
          prompt_version: null,
          created_at: "2026-06-15T11:00:00Z",
          updated_at: "2026-06-15T11:00:00Z",
        });
      }),
    );
    renderWithProviders(<RevisionsTab />);
    const restoreButtons = await screen.findAllByRole("button", {
      name: hu.revisions.restore,
    });
    await userEvent.click(restoreButtons[0]);
    await waitFor(() => expect(approves.length).toBe(1));
  });

  it("Reject calls the reject endpoint", async () => {
    const rejects: string[] = [];
    server.use(
      http.post(`${base}/revisions/:id/reject`, ({ params }) => {
        rejects.push(String(params.id));
        return HttpResponse.json({
          id: String(params.id),
          scene_id: SCENE_ACTIVE.id,
          job_id: null,
          content: "x",
          approved: false,
          revision_type: "rewrite",
          model_name: null,
          prompt_version: null,
          created_at: "2026-06-15T11:00:00Z",
          updated_at: "2026-06-15T11:00:00Z",
        });
      }),
    );
    renderWithProviders(<RevisionsTab />);
    const rejectButtons = await screen.findAllByRole("button", {
      name: hu.revisions.reject,
    });
    await userEvent.click(rejectButtons[0]);
    await waitFor(() => expect(rejects.length).toBe(1));
  });

  it("shows the empty state when the scene has no revisions", async () => {
    server.use(http.get(`${base}/revisions`, () => HttpResponse.json([])));
    renderWithProviders(<RevisionsTab />);
    await waitFor(() =>
      expect(screen.getByText(hu.revisions.empty)).toBeInTheDocument(),
    );
  });
});
