"use client";

import { useState } from "react";
import {
  Archive,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import {
  ConfirmDialog,
  MenuRow,
  MenuSeparator,
  PopoverMenu,
  PopoverMenuContent,
  PopoverMenuTrigger,
} from "@/components/kit";
import { Icon } from "@/components/kit/icon";
import { hu } from "@/lib/i18n/hu";
import type { PlanScene } from "./types";

export interface SceneKebabProps {
  scene: PlanScene;
  onOpen: () => void;
  onChangePov: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

/**
 * SceneCard kebab menu: Megnyitás írásra / POV váltás / Duplikálás / Archiválás
 * (a separator) / Törlés. Built on the PopoverMenu kit primitive. Delete opens a
 * destructive `ConfirmDialog` (AlertDialog) — the actual DELETE only fires on
 * confirm. POV change is a documented stub (see use-plan-board). The trigger
 * stops click propagation so opening the menu does not also select/open the card.
 */
export function SceneKebab({
  scene,
  onOpen,
  onChangePov,
  onDuplicate,
  onArchive,
  onDelete,
}: SceneKebabProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <PopoverMenu>
        <PopoverMenuTrigger asChild>
          <button
            type="button"
            aria-label={hu.plan.sceneMenuAria}
            title={hu.plan.sceneMenuAria}
            onClick={(e) => e.stopPropagation()}
            className="flex h-6 w-6 items-center justify-center rounded-md border-none bg-transparent text-text-faint hover:bg-surface-muted hover:text-text"
          >
            <Icon icon={MoreVertical} size={14} />
          </button>
        </PopoverMenuTrigger>
        <PopoverMenuContent align="end" onClick={(e) => e.stopPropagation()}>
          <MenuRow
            leadingIcon={<Icon icon={Pencil} size={13} />}
            onSelect={onOpen}
          >
            {hu.plan.kebabOpen}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={UserRound} size={13} />}
            onSelect={onChangePov}
          >
            {hu.plan.kebabPov}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={Copy} size={13} />}
            onSelect={onDuplicate}
          >
            {hu.plan.kebabDuplicate}
          </MenuRow>
          <MenuRow
            leadingIcon={<Icon icon={Archive} size={13} />}
            onSelect={onArchive}
          >
            {hu.plan.kebabArchive}
          </MenuRow>
          <MenuSeparator />
          <MenuRow
            variant="danger"
            leadingIcon={<Icon icon={Trash2} size={13} />}
            onSelect={() => setConfirmOpen(true)}
          >
            {hu.plan.kebabDelete}
          </MenuRow>
        </PopoverMenuContent>
      </PopoverMenu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={hu.plan.deleteTitle}
        description={hu.plan.deleteDescription(scene.title)}
        onConfirm={onDelete}
      />
    </>
  );
}
