/**
 * Automated accessibility (axe-core) gate for the kit primitives (UX-4b).
 *
 * Each test renders a representative configuration of a primitive and asserts
 * axe finds NO violations. Overlay primitives (Modal, ConfirmDialog, Tooltip,
 * PopoverMenu) are rendered in their OPEN state and scanned against
 * `document.body` so axe sees the portalled content.
 *
 * Rule config (incl. the documented color-contrast exclusion) lives in
 * `test/a11y.ts`.
 */
import { describe, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expectNoA11yViolations } from "@/test/a11y";
import { TooltipProvider } from "@/components/kit/tooltip";
import { Button } from "@/components/kit/button";
import { IconButton } from "@/components/kit/icon-button";
import { FormInput } from "@/components/kit/form-input";
import { Textarea } from "@/components/kit/textarea";
import { CheckboxRow } from "@/components/kit/checkbox-row";
import { RadioGroup, RadioRow } from "@/components/kit/radio-group";
import { ToggleSwitch } from "@/components/kit/toggle-switch";
import { Tab, TabBar } from "@/components/kit/tab";
import { Badge, StatusPill } from "@/components/kit/badge";
import { AIResultCard } from "@/components/kit/ai-result-card";
import {
  Modal,
  ModalShell,
  ModalHeader,
  ModalBody,
} from "@/components/kit/modal-shell";
import { ConfirmDialog } from "@/components/kit/alert-dialog";
import {
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
} from "@/components/kit/tooltip";
import {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuSection,
  MenuRow,
} from "@/components/kit/popover-menu";

const VARIANTS = [
  "cta",
  "secondary",
  "ghost",
  "success",
  "destructive",
  "accent-outline",
  "dashed",
] as const;

describe("a11y: kit primitives", () => {
  it("Button — every variant carries an accessible name", async () => {
    const { container } = render(
      <div>
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant}
          </Button>
        ))}
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("IconButton — icon-only button is named via aria-label", async () => {
    const { container } = render(
      <IconButton aria-label="Hozzáadás">
        <svg aria-hidden="true" focusable="false" />
      </IconButton>,
    );
    await expectNoA11yViolations(container);
  });

  it("FormInput — labelled (normal) field", async () => {
    const { container } = render(
      <div>
        <label htmlFor="title">Cím</label>
        <FormInput id="title" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("FormInput — error field wires aria-invalid + alert", async () => {
    const { container } = render(
      <div>
        <label htmlFor="title-err">Cím</label>
        <FormInput id="title-err" error="Kötelező mező" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("Textarea — labelled field", async () => {
    const { container } = render(
      <div>
        <label htmlFor="notes">Jegyzetek</label>
        <Textarea id="notes" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("CheckboxRow / RadioGroup / ToggleSwitch — labelled controls", async () => {
    const { container } = render(
      <div>
        <CheckboxRow label="AI által látható" defaultChecked />
        <RadioGroup defaultValue="a" aria-label="Nézőpont">
          <RadioRow value="a" label="Első" />
          <RadioRow value="b" label="Harmadik" />
        </RadioGroup>
        <ToggleSwitch label="Fókusz mód" />
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("Tab / TabBar — tablist with named tabs and panel", async () => {
    const { container } = render(
      <div>
        <TabBar aria-label="Inspektor">
          <Tab active aria-controls="panel-ai" id="tab-ai">
            AI
          </Tab>
          <Tab aria-controls="panel-meta" id="tab-meta">
            Meta
          </Tab>
        </TabBar>
        <div role="tabpanel" id="panel-ai" aria-labelledby="tab-ai">
          AI panel
        </div>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("Badge / StatusPill — text content is exposed", async () => {
    const { container } = render(
      <div>
        <Badge variant="ai">AI</Badge>
        <StatusPill variant="success">Kész</StatusPill>
      </div>,
    );
    await expectNoA11yViolations(container);
  });

  it("AIResultCard — labelled result with actions", async () => {
    const { container } = render(
      <AIResultCard
        label="Átírás"
        version="v1.2"
        model="ollama/llama3.2"
        contextEntities={[{ label: "Szelene" }]}
        body="Szelene meg sem rezzent."
        onAccept={() => {}}
        onReject={() => {}}
        onCopy={() => {}}
        onStar={() => {}}
      />,
    );
    await expectNoA11yViolations(container);
  });

  it("Modal (open) — dialog has an accessible name", async () => {
    render(
      <Modal open onOpenChange={() => {}}>
        <ModalShell>
          <ModalHeader title="Új Codex-bejegyzés" />
          <ModalBody>
            <label htmlFor="m-name">Név</label>
            <FormInput id="m-name" />
          </ModalBody>
        </ModalShell>
      </Modal>,
    );
    await screen.findByRole("dialog");
    await expectNoA11yViolations(document);
  });

  it("ConfirmDialog (open) — alertdialog named + described", async () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Végleges törlés?"
        description="Ez a művelet nem vonható vissza."
        confirmLabel="Végleges törlés"
        onConfirm={() => {}}
      />,
    );
    await screen.findByRole("alertdialog");
    await expectNoA11yViolations(document);
  });

  it("Tooltip (open) — trigger + content", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <TooltipRoot open>
          <TooltipTrigger asChild>
            <IconButton aria-label="Súgó">
              <svg aria-hidden="true" focusable="false" />
            </IconButton>
          </TooltipTrigger>
          <TooltipContent>Billentyűparancsok</TooltipContent>
        </TooltipRoot>
      </TooltipProvider>,
    );
    await expectNoA11yViolations(document);
  });

  it("PopoverMenu (open) — menu rows are reachable + named", async () => {
    render(
      <PopoverMenu>
        <PopoverMenuTrigger>Műveletek</PopoverMenuTrigger>
        <PopoverMenuContent>
          <MenuSection label="Jelenet" />
          <MenuRow onSelect={() => {}}>Archiválás</MenuRow>
          <MenuRow variant="danger" onSelect={() => {}}>
            Törlés
          </MenuRow>
        </PopoverMenuContent>
      </PopoverMenu>,
    );
    await userEvent.click(screen.getByText("Műveletek"));
    await screen.findByRole("menu");
    await expectNoA11yViolations(document);
  });
});
