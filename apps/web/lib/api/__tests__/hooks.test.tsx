import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import {
  useCreateBookWithProject,
  useProjects,
} from "@/lib/api/hooks";
import { PROJECTS_FIXTURE } from "@/test/msw/fixtures";
import { Providers, createTestQueryClient } from "@/test/test-utils";

const base = `${API_BASE_URL}/api/v1`;

function wrapper() {
  const client = createTestQueryClient();
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <Providers client={client}>{children}</Providers>;
  };
}

describe("useProjects", () => {
  it("returns the mocked project list", async () => {
    const { result } = renderHook(() => useProjects(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(PROJECTS_FIXTURE.length);
    expect(result.current.data?.[0].title).toBe("A Fárosz őrzője");
  });

  it("surfaces an error when the API fails (not swallowed)", async () => {
    server.use(
      http.get(`${base}/projects`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    const { result } = renderHook(() => useProjects(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("boom");
  });
});

describe("useCreateBookWithProject", () => {
  it("creates a project then a book and returns the book", async () => {
    const { result } = renderHook(() => useCreateBookWithProject(), {
      wrapper: wrapper(),
    });
    result.current.mutate({
      project: { title: "Új", language: "hu" },
      book: { title: "Új", language: "hu", order_index: 0 },
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.title).toBe("Új");
    expect(result.current.data?.project_id).toBeTruthy();
  });

  it("surfaces an error when project creation fails", async () => {
    server.use(
      http.post(`${base}/projects`, () =>
        HttpResponse.json({ detail: "nope" }, { status: 400 }),
      ),
    );
    const { result } = renderHook(() => useCreateBookWithProject(), {
      wrapper: wrapper(),
    });
    result.current.mutate({
      project: { title: "X", language: "hu" },
      book: { title: "X", language: "hu", order_index: 0 },
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("nope");
  });
});
