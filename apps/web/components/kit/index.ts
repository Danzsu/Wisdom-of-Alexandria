/**
 * Shared component kit barrel (Milestone 1a — controls + display primitives).
 * Screens import primitives from here rather than reaching into single files.
 */
export { BrandStar, type BrandStarProps } from "./brand-star";
export { Icon, type IconProps } from "./icon";
export { IconButton, type IconButtonProps } from "./icon-button";
export { Button, buttonVariants, type ButtonProps } from "./button";
export {
  PillButton,
  FilterChip,
  type PillButtonProps,
} from "./pill-button";
export {
  SegmentedControl,
  type SegmentedControlProps,
  type SegmentedOption,
} from "./segmented-control";
export { Tab, TabBar, type TabProps, type TabBarProps } from "./tab";
export {
  SectionEyebrow,
  type SectionEyebrowProps,
} from "./section-eyebrow";
export { PageHero, type PageHeroProps } from "./page-hero";
export { Badge, StatusPill, type BadgeProps } from "./badge";
export {
  StatusDot,
  type StatusDotProps,
  type StatusDotVariant,
} from "./status-dot";
export {
  Avatar,
  type AvatarProps,
  type AvatarSize,
  type AvatarColor,
} from "./avatar";
export { Card, type CardProps, type CardAccentEdge } from "./card";
export { QuoteBlock, type QuoteBlockProps } from "./quote-block";
export { ProgressBar, type ProgressBarProps } from "./progress-bar";
export { Spinner, type SpinnerProps } from "./spinner";
export { Skeleton, type SkeletonProps } from "./skeleton";
export {
  VariableTokenChip,
  type VariableTokenChipProps,
} from "./variable-token-chip";
export {
  BookSpineCard,
  CoverThumbnail,
  type BookSpineCardProps,
  type BookSpineSize,
} from "./book-spine-card";
export {
  ContextChips,
  type ContextChipsProps,
  type ContextEntity,
} from "./context-chips";
export { BarChart, type BarChartProps, type BarChartDatum } from "./bar-chart";
export { Sparkline, type SparklineProps } from "./sparkline";
export {
  TimelineNode,
  TimelineMarker,
  TimelineSpine,
  type TimelineNodeProps,
  type TimelineMarkerProps,
  type TimelineMarkerState,
} from "./timeline";
export { ThemeToggle } from "./theme-toggle";

/* ---------------------------------------------------------------------------
 * Milestone 1b — Radix-based interactive + composite primitives.
 * ------------------------------------------------------------------------- */
export { FormInput, FieldLabel, type FormInputProps } from "./form-input";
export { Textarea, textareaVariants, type TextareaProps } from "./textarea";
export { PasswordInput, type PasswordInputProps } from "./password-input";
export { ToggleSwitch, type ToggleSwitchProps } from "./toggle-switch";
export {
  CheckboxRow,
  CheckBox,
  SelectableCheckboxCard,
  type CheckboxRowProps,
  type SelectableCheckboxCardProps,
} from "./checkbox-row";
export {
  RadioGroup,
  RadioRow,
  TypedRadioGroup,
  type RadioRowProps,
  type RadioOption,
  type TypedRadioGroupProps,
} from "./radio-group";
export { RangeSlider, type RangeSliderProps } from "./range-slider";
export {
  PopoverMenu,
  PopoverMenuTrigger,
  PopoverMenuContent,
  MenuRow,
  MenuSection,
  MenuSeparator,
  menuRowVariants,
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverPanel,
} from "./popover-menu";
export {
  SplitButtonDropdown,
  type SplitButtonDropdownProps,
  type SplitMenuItem,
} from "./split-button-dropdown";
export {
  Modal,
  ModalTrigger,
  ModalTitle,
  ModalDescription,
  ModalShell,
  ModalHeader,
  ModalClose,
  ModalFooter,
  ModalBody,
  type ModalShellProps,
  type ModalHeaderProps,
} from "./modal-shell";
export {
  AlertDialog,
  AlertDialogTrigger,
  ConfirmDialog,
  type ConfirmDialogProps,
} from "./alert-dialog";
export { Toaster, toast } from "./toast";
export {
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
  TooltipContent,
  Tooltip,
  tooltipContentVariants,
  type TooltipProps,
} from "./tooltip";
export {
  DashedTile,
  dashedTileVariants,
  type DashedTileProps,
} from "./dashed-tile";
export {
  ModelSelector,
  type ModelSelectorProps,
  type ModelOption,
  type ModelGroup,
} from "./model-selector";
export { AIResultCard, type AIResultCardProps } from "./ai-result-card";
export { ErrorBoundary, type ErrorBoundaryProps } from "./error-boundary";
export {
  DiffPane,
  DiffDeletion,
  DiffAddition,
  type DiffPaneProps,
  type DiffSegment,
  type DiffEqualSegment,
  type DiffDeletionSegment,
  type DiffAdditionSegment,
} from "./diff-pane";

/* ---------------------------------------------------------------------------
 * Milestone 1c — State-pattern library (skeleton patterns, empty, error).
 * ------------------------------------------------------------------------- */
export {
  SkeletonCard,
  SkeletonList,
  SkeletonTable,
  type SkeletonCardProps,
  type SkeletonListProps,
  type SkeletonTableProps,
} from "./skeleton-patterns";
export {
  EmptyState,
  type EmptyStateProps,
  type EmptyStateActionObject,
} from "./empty-state";
export {
  CelestialBackdrop,
  type CelestialBackdropProps,
} from "./celestial-backdrop";
export { ErrorState, type ErrorStateProps } from "./error-state";

/* ---------------------------------------------------------------------------
 * Milestone 1d — Radix Select primitive.
 * ------------------------------------------------------------------------- */
export { Select, type SelectProps, type SelectOption } from "./select";

/* ---------------------------------------------------------------------------
 * Milestone 1e — Button loading state + Accordion + FormInput slots.
 * ------------------------------------------------------------------------- */
export { Accordion, type AccordionProps, type AccordionItem } from "./accordion";
