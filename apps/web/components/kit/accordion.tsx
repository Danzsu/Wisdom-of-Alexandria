import type { ReactNode } from "react";
import * as RadixAccordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AccordionItem {
  id: string;
  title: string;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  /**
   * "single" (default) — only one item open at a time; collapses on re-click.
   * "multiple" — any number of items may be open simultaneously.
   */
  type?: "single" | "multiple";
  /**
   * The item id (or array of ids for "multiple") that should be open on mount.
   * Uncontrolled initial state only.
   */
  defaultValue?: string | string[];
  className?: string;
}

/**
 * Accordion built over `@radix-ui/react-accordion`. Full-border items with a
 * chevron that rotates on open (transform only). Content reveal uses the
 * project's reduced-motion-safe transition approach (transform/opacity; the
 * global `[data-woa] *` transition handles it; no layout animation).
 */
export function Accordion({
  items,
  type = "single",
  defaultValue,
  className,
}: AccordionProps) {
  // Radix's type prop is a discriminated union so we cast carefully.
  const sharedProps = {
    className: cn("flex flex-col gap-2", className),
    collapsible: true as const,
  };

  if (type === "multiple") {
    const multiDefault = defaultValue
      ? Array.isArray(defaultValue)
        ? defaultValue
        : [defaultValue]
      : undefined;
    return (
      <RadixAccordion.Root
        type="multiple"
        defaultValue={multiDefault}
        className={sharedProps.className}
      >
        {items.map((item) => (
          <AccordionItemRow key={item.id} item={item} />
        ))}
      </RadixAccordion.Root>
    );
  }

  // "single"
  const singleDefault =
    defaultValue && !Array.isArray(defaultValue) ? defaultValue : undefined;
  return (
    <RadixAccordion.Root
      type="single"
      collapsible
      defaultValue={singleDefault}
      className={sharedProps.className}
    >
      {items.map((item) => (
        <AccordionItemRow key={item.id} item={item} />
      ))}
    </RadixAccordion.Root>
  );
}

function AccordionItemRow({ item }: { item: AccordionItem }) {
  return (
    <RadixAccordion.Item
      value={item.id}
      className="border border-border rounded-lg overflow-hidden"
    >
      <RadixAccordion.Header>
        <RadixAccordion.Trigger
          className={cn(
            "flex w-full items-center justify-between px-4 py-3",
            "text-left font-sans text-base font-medium text-text",
            "bg-surface hover:bg-surface-muted",
            "transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset",
            "[&>svg]:transition-transform [&>svg]:duration-200",
            "[&[data-state=open]>svg]:rotate-180",
          )}
        >
          {item.title}
          <ChevronDown
            size={16}
            aria-hidden="true"
            className="shrink-0 text-text-muted"
          />
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>
      <RadixAccordion.Content
        className={cn(
          "overflow-hidden text-base text-text-muted",
          "data-[state=open]:animate-none data-[state=closed]:animate-none",
        )}
      >
        <div className="px-4 py-3">{item.content}</div>
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  );
}
