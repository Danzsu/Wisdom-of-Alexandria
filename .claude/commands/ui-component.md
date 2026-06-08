Design and build a ForgeWriter UI component.

Component to build: $ARGUMENTS

UI rules (from CLAUDE.md and design spec):
- Design tokens: background #f8f6f2, surface #ffffff, accent #6d5dfc, text #2f2a24
- Component library: shadcn/ui + Tailwind CSS + Framer Motion
- Icons: Lucide React only
- Toast notifications: Sonner
- No hardcoded colors — use CSS variables or token constants from apps/web/src/styles/tokens.ts
- Rounded cards (rounded-xl), soft shadows, subtle borders (#ded8ce)
- Calm, focused, writer-first interface — no flashy gradients or bright colors
- AI-generated content cards: use ai (#7c3aed) accent color and aiMuted (#f0e9ff) background
- Manuscript editor font: Literata (serif), UI font: Inter or Geist

After building:
1. Check accessibility with fixing-accessibility skill
2. Verify with verification-before-completion skill
