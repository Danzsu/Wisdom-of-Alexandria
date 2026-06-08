# ForgeWriter AI — Design System

## Design philosophy

Calm, focused, writer-first. Inspired by professional writing tools (Scrivener, iA Writer) with a modern web app structure (NovelCrafter-like layout). Dense but readable. Not minimal to the point of emptiness, but never cluttered.

## Color tokens

```
background:   #f8f6f2   warm off-white — primary page background
surface:      #ffffff   card, panel, modal backgrounds
surfaceMuted: #f1eee8   secondary panel, sidebar, hover states
border:       #ded8ce   all borders, dividers, card edges
text:         #2f2a24   primary text — warm near-black
textMuted:    #6f675f   secondary text, labels, metadata
accent:       #6d5dfc   primary accent — muted purple/indigo (CTA, active states, links)
accentMuted:  #ebe9ff   accent hover, chip backgrounds, selected states
ai:           #7c3aed   AI-generated content indicator (darker purple)
aiMuted:      #f0e9ff   AI content card backgrounds
success:      #2f7d55   saved, approved, completed
warning:      #b7791f   continuity warnings, draft status
danger:       #c2410c   errors, destructive actions
```

## Typography

- **UI font**: Inter or Geist (system-ui fallback)
- **Manuscript font**: Literata (serif) — for the editor only
- **Code/metadata**: JetBrains Mono or system monospace

Font scale (Tailwind defaults are fine):
- xs: 11px — labels, badges, metadata
- sm: 13px — secondary content, sidebar items
- base: 14px — primary UI text
- lg: 16px — headings, panel titles
- xl: 18-20px — page titles
- Manuscript: 16-18px Literata, generous line-height (1.8)

## Elevation / Surfaces

Three levels:
1. Page background: `#f8f6f2` (warm off-white)
2. Card/panel: `#ffffff` with `border: 1px solid #ded8ce`, `box-shadow: 0 1px 3px rgba(47,42,36,0.08)`
3. Floating (dropdown, modal): `#ffffff` with stronger shadow `0 4px 16px rgba(47,42,36,0.12)`

## Layout structure

```
┌─────────────────────────────────────────────────────┐
│ Top bar (project name + model status + actions)     │
├──────────┬─────────────────────────┬────────────────┤
│ Left nav │ Central content area    │ Right context  │
│ 240px    │ flex-1                  │ panel 320px    │
│          │                         │ (Codex / AI)   │
│ Project  │ Editor / Board / List   │ collapsible    │
│ tree     │                         │                │
└──────────┴─────────────────────────┴────────────────┘
```

## Component patterns

### Cards
- `rounded-xl` (12px radius) for scene/chapter/codex cards
- `rounded-lg` (8px) for inline components
- Subtle shadow + warm border on all cards
- Hover: slight shadow lift + `#f1eee8` background tint

### Buttons
- Primary: `bg-accent text-white` (`#6d5dfc`)
- Secondary: `bg-surface border border-border text-text`
- Ghost: `text-textMuted hover:bg-surfaceMuted`
- Destructive: `bg-danger text-white`
- All buttons: `rounded-lg`, `h-8 px-3` for compact, `h-9 px-4` for standard

### AI content indicators
- AI-generated content: left border `border-l-4 border-ai` + `bg-aiMuted`
- AI status chip: `bg-aiMuted text-ai text-xs font-medium px-2 py-0.5 rounded`
- Pending approval: pulsing dot in `ai` color

### Badges / Status
- Draft: `bg-surfaceMuted text-textMuted`
- In progress: `bg-yellow-50 text-warning border border-yellow-200`
- Complete: `bg-green-50 text-success border border-green-200`
- AI pending: `bg-aiMuted text-ai border border-purple-200`

### Editor (Tiptap manuscript area)
- Background: `#ffffff` with gentle shadow
- Font: Literata 17px, line-height 1.8, color `#2f2a24`
- Max-width: 720px centered
- Padding: 48px horizontal, 64px vertical
- Word count: subtle gray at bottom
- Bubble menu: white card with `rounded-xl shadow-lg`

## Motion

Subtle and purposeful (Framer Motion):
- Panel open/close: `x: ±20, opacity: 0→1`, `duration: 0.18`
- Card hover lift: `y: -2, shadow increase`, `duration: 0.12`
- AI result appear: `y: 8→0, opacity: 0→1`, `duration: 0.22`
- Page transitions: `opacity: 0→1`, `duration: 0.15`
- No bouncy springs, no dramatic slides

## What NOT to do

- No dark navy/slate background (#0f172a is NovelCrafter's territory)
- No hot pink, neon, or saturated gradients
- No glassmorphism
- No emoji in UI labels (unless explicitly in user content)
- No comic-sans or display fonts in UI
- No oversized hero images
- No auto-playing animations or attention-seeking motion
