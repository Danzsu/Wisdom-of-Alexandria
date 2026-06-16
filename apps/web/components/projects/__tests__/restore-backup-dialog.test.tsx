import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { renderWithProviders } from "@/test/test-utils";
import { hu } from "@/lib/i18n/hu";
import { RestoreBackupDialog } from "@/components/projects/restore-backup-dialog";

const base = `${API_BASE_URL}/api/v1`;

function jsonFile(name = "backup.json"): File {
  return new File(['{"version":1,"project":{"title":"x"}}'], name, {
    type: "application/json",
  });
}

function renderDialog(onOpenChange: (open: boolean) => void = () => {}) {
  return renderWithProviders(
    <RestoreBackupDialog open onOpenChange={onOpenChange} />,
  );
}

describe("RestoreBackupDialog", () => {
  it("disables submit until a .json file is chosen", async () => {
    renderDialog();
    const submit = screen.getByRole("button", { name: hu.backup.submit });
    expect(submit).toBeDisabled();

    await userEvent.upload(
      screen.getByLabelText(hu.backup.fileLabel),
      jsonFile(),
    );
    expect(submit).toBeEnabled();
  });

  it("rejects a non-.json file client-side", async () => {
    renderDialog();
    const txt = new File(["hi"], "notes.txt", { type: "text/plain" });
    await userEvent.upload(screen.getByLabelText(hu.backup.fileLabel), txt, {
      applyAccept: false,
    });

    expect(
      await screen.findByText(new RegExp(hu.backup.wrongTypeError)),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: hu.backup.submit }),
    ).toBeDisabled();
  });

  it("restores and closes on success", async () => {
    let closed = false;
    server.use(
      http.post(`${base}/projects/restore`, () =>
        HttpResponse.json(
          {
            project_id: "restored-1",
            title: "Visszaállított",
            series_count: 0,
            book_count: 1,
            chapter_count: 1,
            scene_count: 1,
            beat_count: 0,
            codex_entry_count: 0,
            character_count: 0,
            location_count: 0,
            worldbuilding_count: 0,
            snippet_count: 0,
            style_guide_count: 0,
            codex_relation_count: 0,
            codex_progression_count: 0,
          },
          { status: 201 },
        ),
      ),
    );

    renderDialog((next) => {
      if (!next) closed = true;
    });
    await userEvent.upload(
      screen.getByLabelText(hu.backup.fileLabel),
      jsonFile(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: hu.backup.submit }),
    );

    await waitFor(() => expect(closed).toBe(true));
  });

  it("surfaces the server error detail and stays open", async () => {
    server.use(
      http.post(`${base}/projects/restore`, () =>
        HttpResponse.json(
          { detail: "Unsupported backup version: 999" },
          { status: 422 },
        ),
      ),
    );

    renderDialog();
    await userEvent.upload(
      screen.getByLabelText(hu.backup.fileLabel),
      jsonFile(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: hu.backup.submit }),
    );

    expect(
      await screen.findByText(/Unsupported backup version: 999/),
    ).toBeInTheDocument();
  });
});
