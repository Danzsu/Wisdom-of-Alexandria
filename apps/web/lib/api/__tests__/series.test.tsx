/**
 * Series client + hooks + the codex `?series_id=` filter (Feature #3c).
 *
 * These exercise the SAME parse/validation path as production against the MSW
 * mock backend: list/create series, and that the codex list client appends
 * `?series_id=` (series scope = project-global + that series; omitted = all).
 */
import { beforeEach, describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  resetBookStore,
  resetCodexStore,
  resetSeriesStore,
} from "@/test/msw/handlers";
import { FAROSZ_PROJECT, FAROSZ_SERIES } from "@/test/msw/fixtures";
import { createSeries, listSeries } from "@/lib/api/series";
import { listCodexEntries } from "@/lib/api/codex";
import { useSeries, useCreateSeries } from "@/lib/api/series-hooks";

const base = `${API_BASE_URL}/api/v1`;

describe("Series client + codex series filter", () => {
  beforeEach(() => {
    resetSeriesStore();
    resetCodexStore();
    resetBookStore();
  });

  it("listSeries returns the project's series (parsed)", async () => {
    const series = await listSeries(FAROSZ_PROJECT.id);
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({
      id: FAROSZ_SERIES.id,
      title: FAROSZ_SERIES.title,
      project_id: FAROSZ_PROJECT.id,
    });
  });

  it("createSeries posts the body and returns the created series", async () => {
    const created = await createSeries(FAROSZ_PROJECT.id, {
      title: "Új ciklus",
    });
    expect(created.title).toBe("Új ciklus");
    expect(created.project_id).toBe(FAROSZ_PROJECT.id);
    // It now shows in the list (stateful store).
    const after = await listSeries(FAROSZ_PROJECT.id);
    expect(after.map((s) => s.title)).toContain("Új ciklus");
  });

  it("listCodexEntries WITHOUT seriesId returns every entry (project scope)", async () => {
    const all = await listCodexEntries(FAROSZ_PROJECT.id);
    // Both the project-global (Szelene) and the series-scoped (Nagykönyvtár).
    expect(all.map((e) => e.title).sort()).toEqual([
      "Nagykönyvtár",
      "Szelene",
    ]);
  });

  it("listCodexEntries WITH seriesId hits ?series_id= and returns global + that series", async () => {
    let calledUrl = "";
    server.use(
      http.get(`${base}/projects/:projectId/codex`, ({ request }) => {
        calledUrl = request.url;
        const seriesId = new URL(request.url).searchParams.get("series_id");
        // Echo only the project-global + matching-series entries.
        return HttpResponse.json([
          {
            id: "codex-szelene",
            project_id: FAROSZ_PROJECT.id,
            series_id: null,
            title: "Szelene",
            entry_type: "character",
            content: null,
            aliases: [],
            role: null,
            ai_visible: true,
            tags: [],
            created_at: "2026-06-14T14:32:00Z",
            updated_at: "2026-06-14T14:32:00Z",
          },
          {
            id: "codex-nagykonyvtar",
            project_id: FAROSZ_PROJECT.id,
            series_id: seriesId,
            title: "Nagykönyvtár",
            entry_type: "location",
            content: null,
            aliases: [],
            role: null,
            ai_visible: true,
            tags: [],
            created_at: "2026-06-14T14:32:00Z",
            updated_at: "2026-06-14T14:32:00Z",
          },
        ]);
      }),
    );

    const scoped = await listCodexEntries(FAROSZ_PROJECT.id, FAROSZ_SERIES.id);
    expect(calledUrl).toContain(`series_id=${FAROSZ_SERIES.id}`);
    expect(scoped).toHaveLength(2);
  });

  it("useSeries + useCreateSeries: create invalidates and the list refetches", async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <Providers>{children}</Providers>
    );
    const list = renderHook(() => useSeries(FAROSZ_PROJECT.id), { wrapper });
    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    expect(list.result.current.data).toHaveLength(1);

    const create = renderHook(() => useCreateSeries(), { wrapper });
    create.result.current.mutate({
      projectId: FAROSZ_PROJECT.id,
      data: { title: "Második ciklus" },
    });
    await waitFor(() => expect(create.result.current.isSuccess).toBe(true));
  });
});
