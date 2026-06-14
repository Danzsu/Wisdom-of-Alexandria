import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIResultCard } from "@/components/kit/ai-result-card";

describe("AIResultCard", () => {
  it("renders the label heading, version, body and disclaimer", () => {
    render(
      <AIResultCard
        label="Átírás"
        version="v1.2"
        model="ollama/llama3.2"
        contextEntities={[{ label: "Szelene" }]}
        body="Szelene meg sem rezzent."
      />,
    );
    expect(screen.getByText("Átírás eredménye")).toBeInTheDocument();
    expect(screen.getByText("v1.2")).toBeInTheDocument();
    expect(screen.getByText("Szelene meg sem rezzent.")).toBeInTheDocument();
    expect(screen.getByText("Szelene")).toBeInTheDocument();
    expect(screen.getByText("ollama/llama3.2")).toBeInTheDocument();
    expect(
      screen.getByText("Az AI sosem ír a kéziratba jóváhagyás nélkül."),
    ).toBeInTheDocument();
  });

  it("fires accept / reject / copy / star callbacks", async () => {
    const onAccept = vi.fn();
    const onReject = vi.fn();
    const onCopy = vi.fn();
    const onStar = vi.fn();
    render(
      <AIResultCard
        label="Átírás"
        body="…"
        onAccept={onAccept}
        onReject={onReject}
        onCopy={onCopy}
        onStar={onStar}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Elfogad" }));
    await userEvent.click(screen.getByRole("button", { name: "Elvet" }));
    await userEvent.click(screen.getByRole("button", { name: "Másolás" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Mentés Snippetként" }),
    );
    expect(onAccept).toHaveBeenCalledOnce();
    expect(onReject).toHaveBeenCalledOnce();
    expect(onCopy).toHaveBeenCalledOnce();
    expect(onStar).toHaveBeenCalledOnce();
  });
});
