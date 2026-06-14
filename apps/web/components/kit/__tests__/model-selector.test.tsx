import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ModelSelector, type ModelGroup } from "@/components/kit/model-selector";

const GROUPS: ModelGroup[] = [
  {
    label: "Lokális",
    models: [
      { id: "ollama/llama3.2", label: "ollama/llama3.2", kind: "local" },
      { id: "ollama/mistral-nemo", label: "ollama/mistral-nemo", kind: "local" },
    ],
  },
  {
    label: "Felhő",
    models: [
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", kind: "cloud" },
      {
        id: "claude-4.5-sonnet",
        label: "Claude 4.5 Sonnet",
        kind: "cloud",
        moderated: true,
      },
    ],
  },
];

describe("ModelSelector", () => {
  it("shows the selected model label on the trigger", () => {
    render(
      <ModelSelector
        groups={GROUPS}
        value="ollama/llama3.2"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("ollama/llama3.2")).toBeInTheDocument();
  });

  it("opens, shows the section headings and a Moderált badge, and fires onChange", async () => {
    const onChange = vi.fn();
    render(
      <ModelSelector groups={GROUPS} value="ollama/llama3.2" onChange={onChange} />,
    );
    await userEvent.click(screen.getByRole("button"));
    expect(await screen.findByText("Felhő")).toBeInTheDocument();
    expect(screen.getByText("Lokális")).toBeInTheDocument();
    expect(screen.getByText("Moderált")).toBeInTheDocument();

    await userEvent.click(screen.getByText("Gemini 2.5 Flash"));
    expect(onChange).toHaveBeenCalledExactlyOnceWith("gemini-2.5-flash");
  });
});
