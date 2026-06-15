import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { Providers } from "@/test/test-utils";
import { server } from "@/test/msw/server";
import { AI_BASE_URL } from "@/lib/api/client";
import { FAROSZ_BOOK, JOB_FAILED } from "@/test/msw/fixtures";
import { JobsScreen } from "../jobs-screen";

const aiBase = `${AI_BASE_URL}/api/v1`;

function renderScreen(bookId: string | undefined = FAROSZ_BOOK.id) {
  return render(
    <Providers>
      <JobsScreen bookId={bookId} />
    </Providers>,
  );
}

describe("JobsScreen (AI feladatok)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the seeded jobs with localized type + status badges", async () => {
    renderScreen();
    // The done job (rewrite) and its status pill.
    expect(await screen.findByText("Átírás")).toBeInTheDocument();
    expect(screen.getByText("Kész")).toBeInTheDocument();
    // The running job (generate_scene).
    expect(screen.getByText("Jelenet generálása")).toBeInTheDocument();
    expect(screen.getByText("Folyamatban")).toBeInTheDocument();
    // The failed job (describe).
    expect(screen.getByText("Érzéki leírás")).toBeInTheDocument();
    expect(screen.getByText("Sikertelen")).toBeInTheDocument();
  });

  it("reveals the sanitized error message for a failed job on expand", async () => {
    renderScreen();
    const toggle = await screen.findByRole("button", {
      name: "Hibaüzenet megjelenítése",
    });
    // Collapsed by default — the message is not shown yet.
    expect(
      screen.queryByText(JOB_FAILED.error_message as string),
    ).not.toBeInTheDocument();
    await userEvent.click(toggle);
    expect(
      await screen.findByText(JOB_FAILED.error_message as string),
    ).toBeInTheDocument();
  });

  it("shows the empty state when the book has no jobs", async () => {
    // A book id with no seeded jobs returns an empty list.
    renderScreen("00000000-0000-0000-0000-000000000000");
    expect(await screen.findByText("Nincs még AI feladat")).toBeInTheDocument();
  });

  it("shows an error state when the jobs fetch fails", async () => {
    server.use(
      http.get(`${aiBase}/jobs`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );
    renderScreen();
    expect(
      await screen.findByText("Nem sikerült betölteni az AI feladatokat"),
    ).toBeInTheDocument();
  });

  it("renders an unknown status/type gracefully (raw fallback, no crash)", async () => {
    server.use(
      http.get(`${aiBase}/jobs`, () =>
        HttpResponse.json([
          {
            id: "job-weird-1",
            scene_id: null,
            chapter_id: null,
            job_type: "teleport_scene",
            status: "frozen",
            model_name: null,
            prompt_version: null,
            input_data: null,
            output_data: null,
            error_message: null,
            created_at: "2026-06-15T11:00:00Z",
            updated_at: "2026-06-15T11:00:00Z",
          },
        ]),
      ),
    );
    renderScreen();
    // The unknown job_type + status fall back to their raw strings.
    expect(await screen.findByText("teleport_scene")).toBeInTheDocument();
    expect(screen.getByText("frozen")).toBeInTheDocument();
    // "Not bound to a scene" context for the null scene/chapter.
    expect(screen.getByText("Nincs jelenethez kötve")).toBeInTheDocument();
  });
});
