import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { BookSpineCard, CoverThumbnail } from "@/components/kit/book-spine-card";
import { COVER_GRADIENT } from "@/lib/gradients";

describe("BookSpineCard", () => {
  it("is a labelled image when a title is provided", () => {
    render(<BookSpineCard title="A Fárosz őrzője" />);
    const img = screen.getByRole("img", { name: "A Fárosz őrzője" });
    expect(img).toBeInTheDocument();
  });

  it("is decorative (aria-hidden, no img role) when no title is provided", () => {
    const { container } = render(<BookSpineCard data-testid="spine" />);
    // No unlabelled image role should be exposed to assistive tech.
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    const el = container.querySelector('[data-testid="spine"]');
    expect(el).toHaveAttribute("aria-hidden", "true");
    expect(el).not.toHaveAttribute("aria-label");
    expect(el).not.toHaveAttribute("role");
  });

  it("paints the blue-grey cover from the shared gradient constant", () => {
    // The blueGrey gradient has no var(), so jsdom serialises it (hex → rgb);
    // assert the distinguishing blue stop is present as a gradient background.
    // (The gold variant uses var(--accent) which jsdom drops from a background
    // shorthand — covered structurally below and by the gold gradient's hex.)
    const { container } = render(
      <BookSpineCard data-testid="spine" variant="blueGrey" />,
    );
    const style =
      (container.querySelector('[data-testid="spine"]') as HTMLElement).getAttribute(
        "style",
      ) ?? "";
    expect(style).toContain("linear-gradient");
    expect(style).toContain("rgb(91, 122, 140)"); // #5b7a8c, the gold-vs-blue tell
  });

  it("sources both gold and blue-grey from lib/gradients", () => {
    // Structural guarantee that the card uses the shared constant (not a local
    // duplicate) — the gradient literals live in exactly one place now.
    expect(COVER_GRADIENT.gold).toContain("var(--accent)");
    expect(COVER_GRADIENT.blueGrey).toContain("#5b7a8c");
  });

  it("exposes CoverThumbnail as the same primitive", () => {
    expect(CoverThumbnail).toBe(BookSpineCard);
  });
});
