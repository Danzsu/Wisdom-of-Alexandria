import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "@/test/msw/server";
import { API_BASE_URL } from "@/lib/api/client";
import { Providers } from "@/test/test-utils";
import { resetCodexStore } from "@/test/msw/handlers";
import { makeCodexEntry } from "@/test/msw/fixtures";
import { FAROSZ_PROJECT } from "@/test/msw/fixtures";
import { NewCodexModal } from "@/components/codex/new-codex-modal";

const base = `${API_BASE_URL}/api/v1`;

describe("NewCodexModal — two-step create", () => {
  beforeEach(() => resetCodexStore());

  it("picks a type, submits, and POSTs the correct payload (aliases → tags)", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();

    // Capture the create payload.
    let captured: unknown = null;
    server.use(
      http.post(`${base}/projects/:projectId/codex`, async ({ request, params }) => {
        captured = await request.json();
        return HttpResponse.json(
          makeCodexEntry(
            String(params.projectId),
            captured as Record<string, never>,
          ),
          { status: 201 },
        );
      }),
    );

    render(
      <Providers>
        <NewCodexModal
          open
          onOpenChange={onOpenChange}
          projectId={FAROSZ_PROJECT.id}
          onCreated={onCreated}
        />
      </Providers>,
    );

    // Step 1 — type picker.
    expect(
      await screen.findByText("Válaszd ki a bejegyzés típusát:"),
    ).toBeInTheDocument();
    await user.click(screen.getByText("Karakter"));

    // Step 2 — form.
    const nameInput = await screen.findByPlaceholderText("A bejegyzés neve…");
    await user.type(nameInput, "Theón");
    await user.type(
      screen.getByPlaceholderText("vesszővel elválasztva…"),
      "a mester, Theónt",
    );
    await user.click(
      screen.getByRole("button", { name: "Bejegyzés létrehozása" }),
    );

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));

    expect(captured).toMatchObject({
      title: "Theón",
      entry_type: "character",
      ai_visible: true,
    });
    // Aliases are folded into tags with the namespaced `__woa:alias=` key.
    expect((captured as { tags: string[] }).tags).toEqual(
      expect.arrayContaining(["__woa:alias=a mester", "__woa:alias=Theónt"]),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("blocks submit until the name is provided", async () => {
    const user = userEvent.setup();
    const onCreated = vi.fn();

    render(
      <Providers>
        <NewCodexModal
          open
          onOpenChange={vi.fn()}
          projectId={FAROSZ_PROJECT.id}
          onCreated={onCreated}
        />
      </Providers>,
    );

    await user.click(await screen.findByText("Helyszín"));
    await user.click(
      screen.getByRole("button", { name: "Bejegyzés létrehozása" }),
    );

    expect(
      await screen.findByText("A név megadása kötelező."),
    ).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it("can step back to the type picker", async () => {
    const user = userEvent.setup();
    render(
      <Providers>
        <NewCodexModal
          open
          onOpenChange={vi.fn()}
          projectId={FAROSZ_PROJECT.id}
          onCreated={vi.fn()}
        />
      </Providers>,
    );
    await user.click(await screen.findByText("Tárgy"));
    await screen.findByPlaceholderText("A bejegyzés neve…");
    await user.click(screen.getByRole("button", { name: "Vissza" }));
    expect(
      await screen.findByText("Válaszd ki a bejegyzés típusát:"),
    ).toBeInTheDocument();
  });
});
