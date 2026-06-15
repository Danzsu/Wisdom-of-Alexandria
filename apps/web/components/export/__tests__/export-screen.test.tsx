import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { resetPlanStore } from "@/test/msw/handlers";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import {
  CHAPTER_ONE,
  FAROSZ_BOOK,
  SCENE_FIRST,
} from "@/test/msw/fixtures";

const base = `${API_BASE_URL}/api/v1`;
let params: Record<string, string | undefined> = { bookId: FAROSZ_BOOK.id };

vi.mock("next/navigation", () => ({
  useParams: () => params,
}));

import { ExportScreen } from "../export-screen";

function renderScreen() {
  return render(
    <Providers>
      <ExportScreen />
    </Providers>,
  );
}

describe("ExportScreen", () => {
  beforeEach(() => {
    params = { bookId: FAROSZ_BOOK.id };
    // Seed the in-memory chapter/scene store so useBookTree (the scope picker
    // data source) returns the Fárosz chapters + scenes.
    resetPlanStore();
    // The download path touches URL.createObjectURL + anchor.click — stub them.
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:woa-test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      () => undefined,
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the EXPORT tab with the resolved title in the book-scope radio", async () => {
    renderScreen();
    expect(
      await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`),
    ).toBeInTheDocument();
    // Filename preview is the ASCII-folded title.
    expect(screen.getByText("a_farosz_orzoje.md")).toBeInTheDocument();
  });

  it("Markdown export triggers the backend call + a download with the ASCII filename", async () => {
    const seen: { method: string; bookId: string }[] = [];
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request, params: p }) => {
        seen.push({ method: request.method, bookId: String(p.bookId) });
        return new HttpResponse("# A Fárosz őrzője\n", {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": 'attachment; filename="a_farosz_orzoje.md"',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`);

    await user.click(screen.getByRole("button", { name: "Exportálás" }));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ method: "POST", bookId: FAROSZ_BOOK.id });
    // Success toast carries the ASCII-folded filename.
    expect(
      await screen.findByText("Exportálva: a_farosz_orzoje.md"),
    ).toBeInTheDocument();
    // The browser download fired (anchor click via the object URL).
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:woa-test");
  });

  it("chapter scope: picking a chapter exports with scope=chapter + its target_id", async () => {
    const seen: { scope: string | null; targetId: string | null }[] = [];
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request }) => {
        const url = new URL(request.url);
        seen.push({
          scope: url.searchParams.get("scope"),
          targetId: url.searchParams.get("target_id"),
        });
        return new HttpResponse(`## 1. ${CHAPTER_ONE.title}\n`, {
          status: 200,
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
            "Content-Disposition": 'attachment; filename="i_fejezet_a_kikoto.md"',
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`);

    // Switch to chapter scope, open the picker, choose the first chapter.
    await user.click(screen.getByRole("radio", { name: /Egy fejezet/ }));
    await user.click(
      await screen.findByRole("button", { name: "Fejezet kiválasztása" }),
    );
    await user.click(await screen.findByText(CHAPTER_ONE.title));

    await user.click(screen.getByRole("button", { name: "Exportálás" }));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ scope: "chapter", targetId: CHAPTER_ONE.id });
    // Filename from the chapter title (server Content-Disposition honored).
    expect(
      await screen.findByText("Exportálva: i_fejezet_a_kikoto.md"),
    ).toBeInTheDocument();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("scene scope: picking a scene exports with scope=scene + its target_id", async () => {
    const seen: { scope: string | null; targetId: string | null }[] = [];
    server.use(
      http.post(`${base}/books/:bookId/exports`, ({ request }) => {
        const url = new URL(request.url);
        seen.push({
          scope: url.searchParams.get("scope"),
          targetId: url.searchParams.get("target_id"),
        });
        return new HttpResponse(`### 1.1 ${SCENE_FIRST.title}\n`, {
          status: 200,
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`);

    await user.click(screen.getByRole("radio", { name: /Egy jelenet/ }));
    await user.click(
      await screen.findByRole("button", { name: "Jelenet kiválasztása" }),
    );
    await user.click(await screen.findByText(SCENE_FIRST.title));

    await user.click(screen.getByRole("button", { name: "Exportálás" }));

    await waitFor(() => expect(seen).toHaveLength(1));
    expect(seen[0]).toEqual({ scope: "scene", targetId: SCENE_FIRST.id });
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledTimes(1);
  });

  it("non-book scope: the export button is disabled until a target is chosen", async () => {
    let called = 0;
    server.use(
      http.post(`${base}/books/:bookId/exports`, () => {
        called += 1;
        return new HttpResponse("# x\n", { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`);

    await user.click(screen.getByRole("radio", { name: /Egy fejezet/ }));
    // No chapter chosen yet → the CTA is disabled and clicking does nothing.
    const cta = screen.getByRole("button", { name: "Exportálás" });
    expect(cta).toBeDisabled();
    await user.click(cta);
    expect(called).toBe(0);
  });

  it("non-Markdown formats are stubbed (no export call) and show the coming badge", async () => {
    let called = 0;
    server.use(
      http.post(`${base}/books/:bookId/exports`, () => {
        called += 1;
        return new HttpResponse("# x\n", { status: 200 });
      }),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`);

    // DOCX card carries a "hamarosan" badge.
    const docxCard = screen.getByRole("button", { name: /DOCX/ });
    await user.click(docxCard);
    await user.click(screen.getByRole("button", { name: "Exportálás" }));

    expect(
      await screen.findByText("A(z) DOCX export a V1-ben érkezik"),
    ).toBeInTheDocument();
    expect(called).toBe(0);
  });

  it("surfaces an export error as an error toast (no swallow)", async () => {
    server.use(
      http.post(`${base}/books/:bookId/exports`, () =>
        HttpResponse.json({ detail: "boom" }, { status: 500 }),
      ),
    );

    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`);

    await user.click(screen.getByRole("button", { name: "Exportálás" }));

    expect(
      await screen.findByText("Az exportálás sikertelen"),
    ).toBeInTheDocument();
    expect(await screen.findByText("boom")).toBeInTheDocument();
  });

  it("switches to the IMPORT tab (V1 stub)", async () => {
    const user = userEvent.setup();
    renderScreen();
    await screen.findByText(`Teljes könyv — ${FAROSZ_BOOK.title}`);

    await user.click(screen.getByRole("tab", { name: "Importálás" }));
    expect(
      await screen.findByText("Húzd ide a fájlt, vagy tallózz"),
    ).toBeInTheDocument();
  });
});
