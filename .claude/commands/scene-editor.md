Work on the ForgeWriter scene editor — Tiptap integration, AI panel, autosave.

Focus area: $ARGUMENTS

Scene editor architecture:
- Editor: Tiptap 2.x in apps/web/src/features/editor/
- Main component: SceneEditor.tsx (Tiptap instance + autosave + word count)
- Bubble menu: BubbleMenuAI.tsx (Rewrite / Continue / Shorten / Translate)
- Right panel: AIPanel.tsx (generation result, approve/reject, revision history)
- State: Zustand store in apps/web/src/features/editor/store/editorStore.ts
- Autosave: debounced PATCH to /api/v1/scenes/{id} every 2s after change
- Word count: Tiptap extension or character count extension
- AI rewrite flow: select text → bubble menu → POST /api/v1/ai/rewrite → SSE stream → AIPanel
- Never overwrite text without user approval — show diff first
