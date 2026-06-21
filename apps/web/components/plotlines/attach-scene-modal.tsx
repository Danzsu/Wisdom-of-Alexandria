"use client";

/**
 * Attach-scene modal (Plotline-b). Picks one of the book's scenes (the ones not
 * already attached to this plotline) and POSTs a `PlotlineSceneCreate`. The
 * scene picker is a styled native `<select>`.
 *
 * A cross-project scene is rejected server-side with 400; the error is surfaced
 * inline AND as a toast — never swallowed.
 */
import { useEffect, useState } from "react";
import {
  Modal,
  ModalShell,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  FieldLabel,
  toast,
} from "@/components/kit";
import { useAttachPlotlineScene } from "@/lib/api/hooks";
import { hu } from "@/lib/i18n/hu";
import { cn } from "@/lib/utils";

/** A scene the picker can offer (id + display title). */
export interface AttachableScene {
  id: string;
  title: string;
}

export interface AttachSceneModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plotlineId: string;
  /** The book's scenes that are NOT yet attached to this plotline. */
  scenes: readonly AttachableScene[];
}

const SELECT_CLASS = cn(
  "box-border h-9 w-full rounded-lg border border-border bg-surface px-3 font-sans text-[14px] text-text outline-none",
  "focus-visible:border-accent focus-visible:shadow-[0_0_0_3px_var(--accent-muted)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
);

export function AttachSceneModal({
  open,
  onOpenChange,
  plotlineId,
  scenes,
}: AttachSceneModalProps) {
  const [sceneId, setSceneId] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const attachScene = useAttachPlotlineScene();

  useEffect(() => {
    if (!open) return;
    setSceneId("");
    setFieldError(null);
    setSubmitError(null);
  }, [open]);

  const noScenes = scenes.length === 0;

  function handleOpenChange(next: boolean) {
    onOpenChange(next);
  }

  function handleSubmit() {
    setFieldError(null);
    setSubmitError(null);
    if (!sceneId) {
      setFieldError(hu.plotlines.attachModalRequired);
      return;
    }
    attachScene.mutate(
      { plotlineId, data: { scene_id: sceneId, order_index: 0 } },
      {
        onSuccess: () => {
          toast.success(hu.plotlines.attachedToast);
          handleOpenChange(false);
        },
        onError: (error) => {
          // Cross-project scene → 400 surfaces here, inline + toast.
          setSubmitError(error.message);
          toast.error(hu.plotlines.attachError);
        },
      },
    );
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalShell maxWidth={420}>
        <ModalHeader title={hu.plotlines.attachModalTitle} />
        <ModalBody>
          {noScenes ? (
            <p className="m-0 text-[13px] leading-[1.5] text-text-muted">
              {hu.plotlines.attachModalNoScenes}
            </p>
          ) : (
            <div className="flex flex-col gap-3.5">
              <div>
                <FieldLabel htmlFor="attach-scene">
                  {hu.plotlines.attachModalSceneLabel}
                </FieldLabel>
                <select
                  id="attach-scene"
                  className={SELECT_CLASS}
                  value={sceneId}
                  onChange={(e) => setSceneId(e.target.value)}
                >
                  <option value="">
                    {hu.plotlines.attachModalScenePlaceholder}
                  </option>
                  {scenes.map((scene) => (
                    <option key={scene.id} value={scene.id}>
                      {scene.title}
                    </option>
                  ))}
                </select>
              </div>

              {fieldError ? (
                <p role="alert" className="m-0 text-[12px] text-danger-text">
                  {fieldError}
                </p>
              ) : null}
              {submitError ? (
                <p role="alert" className="m-0 text-[12px] text-danger-text">
                  {hu.plotlines.attachError}: {submitError}
                </p>
              ) : null}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)}>
            {hu.plotlines.modalCancel}
          </Button>
          <Button
            variant="cta"
            disabled={noScenes || attachScene.isPending}
            onClick={handleSubmit}
          >
            {hu.plotlines.attachModalSubmit}
          </Button>
        </ModalFooter>
      </ModalShell>
    </Modal>
  );
}
