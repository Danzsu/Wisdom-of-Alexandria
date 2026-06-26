import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { server } from "@/test/msw/server";
import { renderWithProviders } from "@/test/test-utils";
import { resetImageStore } from "@/test/msw/handlers";
import { expectNoA11yViolations } from "@/test/a11y";
import { CodexImageLightbox } from "@/components/codex/codex-image-lightbox";
import { hu } from "@/lib/i18n/hu";

describe("CodexImageLightbox", () => {
  beforeEach(() => {
    resetImageStore();
  });
  afterEach(() => server.events.removeAllListeners());

  it("opens with an image: renders an <img> with the fetched src and the entry name as alt/accessible name", async () => {
    renderWithProviders(
      <CodexImageLightbox
        open
        onClose={() => {}}
        name="Szelene"
        assetId="media-szelene"
      />,
    );

    // The image binary is fetched (authenticated) and shown via an object URL.
    const img = (await screen.findByRole("img", {
      name: "Szelene",
    })) as HTMLImageElement;
    // Object URL produced by URL.createObjectURL (polyfilled in vitest.setup).
    await waitFor(() => expect(img.getAttribute("src")).toBeTruthy());
    expect(img.getAttribute("src")).toMatch(/^blob:|^data:|^object:/i);
    // The name appears as the visible caption too.
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Szelene")).toBeInTheDocument();
  });

  it("the close button dismisses (onClose fires)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <CodexImageLightbox
        open
        onClose={onClose}
        name="Szelene"
        assetId="media-szelene"
      />,
    );
    const closeBtn = await screen.findByRole("button", {
      name: hu.codex.lightboxClose,
    });
    await user.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("Escape dismisses (onClose fires)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <CodexImageLightbox
        open
        onClose={onClose}
        name="Szelene"
        assetId="media-szelene"
      />,
    );
    await screen.findByRole("dialog");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("backdrop click dismisses (onClose fires)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(
      <CodexImageLightbox
        open
        onClose={onClose}
        name="Szelene"
        assetId="media-szelene"
      />,
    );
    // The dialog surface IS the full-screen backdrop; clicking it (outside the
    // image/close) dismisses.
    const dialog = await screen.findByRole("dialog");
    await user.click(dialog);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("fallback: with no assetId renders the fallback icon + name and NO broken <img>", async () => {
    renderWithProviders(
      <CodexImageLightbox open onClose={() => {}} name="Helyszín nélkül" />,
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Helyszín nélkül")).toBeInTheDocument();
    // No <img> is rendered when there is no image.
    expect(within(dialog).queryByRole("img")).not.toBeInTheDocument();
    // The fallback decorative icon is present (aria-hidden).
    expect(dialog.querySelector("svg")).toBeTruthy();
  });

  it("renders nothing when closed", () => {
    renderWithProviders(
      <CodexImageLightbox
        open={false}
        onClose={() => {}}
        name="Szelene"
        assetId="media-szelene"
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("has no a11y violations and traps focus inside the dialog", async () => {
    renderWithProviders(
      <CodexImageLightbox
        open
        onClose={() => {}}
        name="Szelene"
        assetId="media-szelene"
      />,
    );
    const dialog = await screen.findByRole("dialog");
    const closeBtn = within(dialog).getByRole("button", {
      name: hu.codex.lightboxClose,
    });
    // Radix moves focus INTO the dialog (to the first focusable element, the
    // close button) and traps it there — assert focus is contained in the
    // dialog, not on document.body.
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    expect(closeBtn).toHaveFocus();
    await expectNoA11yViolations(document);
  });
});
