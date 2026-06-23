# Phase 1 — Design-System Foundation — progress ledger
Plan: docs/superpowers/plans/2026-06-23-design-system-foundation.md
Branch: feat/alexandria-ui · Base: (after docs commit)
Cadence: controller commits each task after review; NO push until end.

## Tasks
- [x] T1: WCAG-AA contrast (--text-faint + destructive fill) + contrast guard
- [ ] T2: ProgressBar accessible name
- [ ] T3: StatusDot role=img when labelled (fixes DiffPane)
- [ ] T4: Tabs inside tablist
- [ ] T5: localize transport-error message
- [ ] T6: scale tokens (type/radius) + migrate kit (no visual change)
- [ ] T7: Skeleton patterns (Card/List/Table)
- [ ] T8: EmptyState (+ ScreenPlaceholder on it)
- [ ] T9: inline ErrorState (+ dashboard adopt)
- [ ] T10: Radix Select (+ replace native selects)
- [ ] T11: Button loading state
- [ ] T12: Accordion
- [ ] T13: FormInput prefix/suffix
- [ ] T14: sanity + live a11y re-verify
P1-T1 complete (review clean) 97c583d
P1-T2..T5 complete (review clean; LOW logged for final sweep: T3 StatusDot spread-order role override; T2 pin default-name string) 4ac7ef0
P1-T6 complete (redone: non-colliding semantic type scale, zero shift; +tailwind-merge fix) e488177
P1-T7..T9 complete (review clean; LOW: redundant skel class, ErrorState direct import) 661a5d0
P1-T10 complete (Radix Select + panel adoption; +react-select/react-accordion deps) 7f19b58
P1-T11..T13 complete (57d0aa8); P1-T14 GATE PASS: web 745, tsc/lint clean, shared fresh; LIVE: kit a11y 84->100, contrast 86/89->0/0 both themes. PHASE 1 COMPLETE.
