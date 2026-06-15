import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/kit/error-boundary";

/** A child that throws on its first render, then succeeds once `recover` flips. */
function FlakyChild({ recovered }: { recovered: boolean }) {
  if (!recovered) {
    throw new Error("boom");
  }
  return <div> helyreallt</div>;
}

describe("ErrorBoundary", () => {
  it("renders the default in-pane fallback (not a crash) when a child throws", () => {
    // The thrown error logs to console.error from componentDidCatch — silence it
    // so the test output stays clean (the fallback rendering is what we assert).
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary>
        <FlakyChild recovered={false} />
      </ErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(screen.getByText("Ez a panel hibába ütközött")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Újratöltés/ }),
    ).toBeInTheDocument();

    spy.mockRestore();
  });

  it("re-renders the children after the reset path (thrower toggled to success)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const user = userEvent.setup();

    // A harness whose state controls whether the child still throws. The reset
    // button both clears the boundary AND (via onReset) flips the child to a
    // success render, so the recovered content appears.
    function Harness() {
      const [recovered, setRecovered] = useState(false);
      return (
        <ErrorBoundary onReset={() => setRecovered(true)}>
          <FlakyChild recovered={recovered} />
        </ErrorBoundary>
      );
    }

    render(<Harness />);

    // Initially the fallback is shown.
    expect(screen.getByText("Ez a panel hibába ütközött")).toBeInTheDocument();

    // Reset → onReset flips the child to succeed → children render again.
    await user.click(screen.getByRole("button", { name: /Újratöltés/ }));

    expect(screen.getByText("helyreallt")).toBeInTheDocument();
    expect(
      screen.queryByText("Ez a panel hibába ütközött"),
    ).not.toBeInTheDocument();

    spy.mockRestore();
  });

  it("renders a custom render-prop fallback with the caught error + reset", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <ErrorBoundary
        fallback={(error, reset) => (
          <div>
            <span>egyedi: {error.message}</span>
            <button type="button" onClick={reset}>
              vissza
            </button>
          </div>
        )}
      >
        <FlakyChild recovered={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("egyedi: boom")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "vissza" })).toBeInTheDocument();

    spy.mockRestore();
  });
});
