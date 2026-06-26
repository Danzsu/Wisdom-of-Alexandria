import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { hu } from "@/lib/i18n/hu";
import { ImportDocxDialog } from "@/components/projects/import-docx-dialog";

const base = `${API_BASE_URL}/api/v1`;

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, prefetch: vi.fn() }),
}));

function docxFile(name = "regeny.docx"): File {
  return new File([new Uint8Array([0x50, 0x4b, 0x03, 0x04])], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function renderDialog() {
  return renderWithProviders(<ImportDocxDialog open onOpenChange={() => {}} />);
}

describe("ImportDocxDialog", () => {
  it("disables submit until a .docx file is chosen", async () => {
    renderDialog();
    const submit = screen.getByRole("button", { name: hu.importDialog.submit });
    expect(submit).toBeDisabled();

    const input = screen.getByLabelText(hu.importDialog.fileLabel);
    await userEvent.upload(input, docxFile());

    expect(submit).toBeEnabled();
  });

  it("shows the dropzone CTA + accepted-format chip before a file is chosen", () => {
    renderDialog();
    expect(screen.getByText(hu.importDialog.dropzoneCta)).toBeInTheDocument();
    expect(
      screen.getByText(hu.importDialog.acceptedFormat),
    ).toBeInTheDocument();
    // No file-info card yet.
    expect(
      screen.queryByText(hu.importDialog.fileReadyBadge),
    ).not.toBeInTheDocument();
  });

  it("swaps the dropzone for a file-info card once a .docx is selected", async () => {
    renderDialog();
    await userEvent.upload(
      screen.getByLabelText(hu.importDialog.fileLabel),
      docxFile("kalandok.docx"),
    );
    // The chosen file name + "ready" badge appear; the dropzone CTA is gone.
    expect(screen.getByText("kalandok.docx")).toBeInTheDocument();
    expect(
      screen.getByText(hu.importDialog.fileReadyBadge),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(hu.importDialog.dropzoneCta),
    ).not.toBeInTheDocument();
  });

  it("rejects a non-.docx file client-side", async () => {
    renderDialog();
    const input = screen.getByLabelText(hu.importDialog.fileLabel);
    const txt = new File(["hi"], "notes.txt", { type: "text/plain" });
    // applyAccept:false so the .txt reaches the onChange guard (the `accept`
    // attribute would otherwise filter it before the handler runs).
    await userEvent.upload(input, txt, { applyAccept: false });

    expect(
      await screen.findByText(new RegExp(hu.importDialog.wrongTypeError)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: hu.importDialog.submit }),
    ).toBeDisabled();
  });

  it("uploads, then navigates to the new book on success", async () => {
    pushMock.mockClear();
    let sentTitle = false;
    server.use(
      http.post(`${base}/projects/:projectId/imports`, async ({ request }) => {
        const body = await request.text();
        // `request.formData()` is unreliable in jsdom+undici; inspect raw text.
        sentTitle =
          body.includes('name="title"') && body.includes("Saját regény");
        return HttpResponse.json(
          {
            book_id: "new-book-9",
            title: "Saját regény",
            chapter_count: 2,
            scene_count: 3,
            word_count: 12,
          },
          { status: 201 },
        );
      }),
    );

    renderDialog();
    await userEvent.upload(
      screen.getByLabelText(hu.importDialog.fileLabel),
      docxFile(),
    );
    await userEvent.type(
      screen.getByLabelText(hu.importDialog.titleLabel),
      "Saját regény",
    );
    await userEvent.click(
      screen.getByRole("button", { name: hu.importDialog.submit }),
    );

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith("/konyv/new-book-9/terv"),
    );
    expect(sentTitle).toBe(true);
  });

  it("surfaces the server error detail and does not navigate", async () => {
    pushMock.mockClear();
    server.use(
      http.post(`${base}/projects/:projectId/imports`, () =>
        HttpResponse.json(
          { detail: "pandoc failed to read the DOCX" },
          { status: 502 },
        ),
      ),
    );

    renderDialog();
    await userEvent.upload(
      screen.getByLabelText(hu.importDialog.fileLabel),
      docxFile(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: hu.importDialog.submit }),
    );

    expect(
      await screen.findByText(/pandoc failed to read the DOCX/),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });
});
