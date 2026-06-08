# ForgeWriter AI — Product Context

## What this product is

ForgeWriter AI is a local-first, agentic AI novel-writing workspace for Hungarian-language long-form fiction. It combines structured writing workspace (NovelCrafter-style organization), AI creative assistance (Sudowrite-style), and chapter automation (BookNova-style).

## Primary user

Solitary Hungarian fiction author. Typically writes fantasy, historical fiction, or literary fiction. Familiar with word processors but not necessarily technical tools. Values focus, craft, and creative control. Does not want an AI that overwrites their voice — wants one that assists and suggests.

## Users

- **Primary**: Solo Hungarian fiction author, self-hosting on a local machine or small VPS
- **Secondary**: Writing hobbyists, NaNoWriMo participants, indie publishers
- **Non-users**: Teams, English-language writers, short-form content creators

## What makes ForgeWriter different

1. **Hungarian-first**: Understands Hungarian grammar, dialogue conventions (tegezés/magázás), and native sentence structures — not just a translated English tool
2. **Local AI**: Runs Ollama locally — manuscript text never leaves the author's machine unless they explicitly enable cloud models
3. **Structured, not chatty**: AI is embedded into scenes, codex, beats, and revisions — not a chat window
4. **Human in the loop**: Every AI-generated text needs explicit author approval before replacing existing content
5. **Codex-driven**: Characters, locations, worldbuilding as a searchable database that feeds into AI context

## Core product principles

- Writer-first: the UI is for writing, not for configuring AI
- Calm and focused: no distractions, no gamification, no notification spam
- Safe AI: never silently overwrite — always show diff, always ask for approval
- Persistent world: the Codex grows alongside the novel and constrains AI hallucinations
- Privacy by default: cloud models opt-in, local models default

## Brand tone

Serious, calm, craft-focused. Like a professional writing studio, not a tech startup. No hype language. No "magic AI" framing. The product respects the writer's craft.

## Anti-references

- **Avoid**: Notion-like pastel/colorful UI, chatbot-first interfaces, pop-up assistants
- **Avoid**: GameFi/productivity-app gamification, streaks, achievement badges
- **Avoid**: Overly techy/developer aesthetic
- **Avoid**: Copying NovelCrafter's exact color palette (#0f172a dark blue), icons, or proprietary layout

## MVP scope

- Project / Book / Chapter / Scene entities
- Character / Location / Worldbuilding Codex
- Tiptap manuscript editor with autosave
- Chapter and scene planning board
- Ollama local AI connection
- Selected-text rewrite (AI)
- Scene generation from beat list (AI)
- Markdown export
