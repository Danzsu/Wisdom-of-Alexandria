import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// `global-error.tsx` pulls in next/font (via @/lib/fonts) + globals.css, neither
// of which resolve cleanly under jsdom. Stub the font module so the component
// renders its CSS-variable-backed inline styles; the CSS import is a no-op here.
vi.mock("@/lib/fonts", () => ({
  literata: { variable: "--font-literata" },
  sourceSans3: { variable: "--font-sans" },
}));

import AppError from "../(app)/error";
import GlobalError from "../global-error";

const mockError = Object.assign(new Error("kaboom"), { digest: "abc123" });

describe("app/(app)/error.tsx — route-segment boundary", () => {
  it("renders the recoverable in-shell fallback (visible, role=alert)", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AppError error={mockError} reset={() => {}} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Ez a nézet hibába ütközött")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Újratöltés/ }),
    ).toBeInTheDocument();
    spy.mockRestore();
  });

  it("calls reset when the reset button is clicked", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<AppError error={mockError} reset={reset} />);
    await user.click(screen.getByRole("button", { name: /Újratöltés/ }));

    expect(reset).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe("app/global-error.tsx — last-resort root boundary", () => {
  it("renders the Alexandria-styled root fallback with its reset UI", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<GlobalError error={mockError} reset={() => {}} />);

    expect(screen.getByText("Váratlan hiba történt")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Próbáld újra" }),
    ).toBeInTheDocument();
    spy.mockRestore();
  });

  it("calls reset when 'Próbáld újra' is clicked", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<GlobalError error={mockError} reset={reset} />);
    await user.click(screen.getByRole("button", { name: "Próbáld újra" }));

    expect(reset).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});
