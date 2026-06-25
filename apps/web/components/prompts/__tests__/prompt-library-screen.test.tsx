import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Providers } from "@/test/test-utils";
import { expectNoA11yViolations } from "@/test/a11y";
import { hu } from "@/lib/i18n/hu";
import { PROMPT_LIBRARY } from "@/lib/prompt-library-data";

// The screen lives under konyv/[bookId] but does not consume bookId; mock the
// router hook anyway so it behaves like the other book-scoped screens.
const params: Record<string, string | undefined> = { bookId: "book-1" };
vi.mock("next/navigation", () => ({
  useParams: () => params,
}));

import { toast } from "@/components/kit";
import { PromptLibraryScreen } from "../prompt-library-screen";

function renderScreen() {
  return render(
    <Providers>
      <PromptLibraryScreen />
    </Providers>,
  );
}

describe("PromptLibraryScreen", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all six seeded prompt names", () => {
    renderScreen();
    for (const p of PROMPT_LIBRARY) {
      expect(screen.getByText(p.name)).toBeInTheDocument();
    }
    // Exactly the six seeded cards exist.
    expect(PROMPT_LIBRARY).toHaveLength(6);
  });

  it("renders the header copy + the 'Új prompt' action", () => {
    renderScreen();
    expect(
      screen.getByRole("heading", { name: hu.promptLibrary.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(hu.promptLibrary.subtitle)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: hu.promptLibrary.newPrompt }),
    ).toBeInTheDocument();
  });

  it("opens a read-only detail modal showing THAT prompt's template body", async () => {
    const sensory = PROMPT_LIBRARY.find((p) => p.id === "erzeki-leiras")!;
    // A distinctive substring of the Érzéki leírás template — not present in any
    // other prompt body, so finding it proves the right prompt's content showed.
    const distinctive = "látás, hang, tapintás, szag, íz, metafora";
    expect(sensory.template).toContain(distinctive);

    const user = userEvent.setup();
    renderScreen();

    // Click the specific card by its name.
    await user.click(screen.getByRole("button", { name: new RegExp(sensory.name) }));

    // The modal is a dialog; it shows the distinctive template substring.
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent(distinctive);
    // And the prompt name + usage line are inside the modal too.
    expect(dialog).toHaveTextContent(sensory.name);
    expect(dialog).toHaveTextContent(hu.promptLibrary.usesLabel(sensory.uses));
  });

  it("does NOT show another prompt's body before its card is clicked", async () => {
    const user = userEvent.setup();
    renderScreen();
    // The continuation prompt's distinctive token must not be on screen yet.
    expect(screen.queryByText(/Ne zárd le a jelenetet/)).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /Folytatás — alap/ }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Ne zárd le a jelenetet");
  });

  it("'Új prompt' fires an info toast (honest stub — no backend)", async () => {
    const infoSpy = vi.spyOn(toast, "info");
    const user = userEvent.setup();
    renderScreen();

    await user.click(
      screen.getByRole("button", { name: hu.promptLibrary.newPrompt }),
    );
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith(hu.promptLibrary.createSoon);
  });

  it("has no a11y violations on the screen", async () => {
    const { container } = renderScreen();
    await expectNoA11yViolations(container);
  });

  it("has no a11y violations with the detail modal open", async () => {
    const user = userEvent.setup();
    renderScreen();
    await user.click(
      screen.getByRole("button", { name: /Érzéki leírás/ }),
    );
    await screen.findByRole("dialog");
    await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    await expectNoA11yViolations(document);
  });
});
