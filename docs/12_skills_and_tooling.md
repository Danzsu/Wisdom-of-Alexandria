# 12 — Claude Code Skills és Tooling

Ez a dokumentum összeszedi a ForgeWriter AI fejlesztéséhez ajánlott Claude Code skilleket és külső toolingot.

---

## Már telepített, azonnal használható skillek

Ezek a gépen elérhetők és a `/skill-name` paranccsal azonnal hívhatók:

### Elsőrendű prioritás — ezek a legtöbbet fognak kelleni

| Skill | Mikor használd |
| ----- | -------------- |
| `frontend-design:frontend-design` | Bármilyen UI komponens, screen, layout építésekor. Jelenet kártyák, editor, Codex panel, AI result card. |
| `design-system` | A design tokenek generálásakor, visual audit futtatásakor, és ha az UI inkonzisztensnek tűnik. |
| `shadcn-skills` | shadcn/ui komponensek hozzáadásakor, testreszabásakor. |
| `nextjs16-skills` | Next.js App Router minták, server/client components, route handlers. |
| `frontend-patterns` | React kompozíciós minták, Framer Motion animációk, TanStack Query fetchelés. |
| `superpowers:test-driven-development` | Minden új service, agent, API endpoint előtt. TDD workflow. |
| `superpowers:systematic-debugging` | Ha valami nem működik és nem egyértelmű miért. |
| `superpowers:verification-before-completion` | Mielőtt egy feature befejezettnek nyilvánítod. |
| `superpowers:writing-plans` | Minden komolyabb implementáció előtt — részletes terv elkészítéséhez. |

### Másodrendű prioritás — rendszeresen jönnek majd

| Skill | Mikor használd |
| ----- | -------------- |
| `webapp-testing` | Vitest / Playwright tesztek írásánál. |
| `coding-standards` | Code review előtt, refactoring közben. |
| `basic-security-check` | Auth réteg, API kulcs kezelés, JWT implementáció előtt. |
| `fixing-accessibility` | UI screen elkészülte után — a11y ellenőrzés. |
| `documentation-lookup` | Ha egy library API-ja nem egyértelmű (LiteLLM, PydanticAI, Tiptap stb.). |
| `excalidraw-diagram` | Architekturális diagramok, workflow ábrák a docs-ba. |
| `authjs-skills` | V1-ben Auth.js implementációhoz (cloud deploy esetén). |
| `sessions` | Ha a kontextus elfogy hosszú fejlesztési session közben. |

---

## Context7 MCP — Élő dokumentáció lookup

A Context7 MCP plugin már telepítve van és automatikusan aktiválódik ha library-specifikus kérdés van.
Különösen hasznos ezekhez a könyvtárakhoz, mert gyorsan változnak:

```
LiteLLM       — provider konfig, routing, streaming
PydanticAI    — agent definíció, tool use, structured output
Tiptap        — editor extensions, bubble menu, autosave hook
dnd-kit       — DragOverlay, SortableContext, sensors
Framer Motion — AnimatePresence, layout animations, variants
FastAPI       — dependency injection, background tasks, SSE
Alembic       — migration generation, autogenerate patterns
Neon          — serverless Postgres connection pooling
```

Használat: Claude automatikusan hívja, de te is kérheted:
> "Nézz utána a Context7-ben hogyan kell PydanticAI-ban structured output agent-et írni"

---

## Javasolt új skillek telepítése

Ezek nincsenek telepítve de hasznosak lennének a projekthez:

### 1. `ui-ux-pro-max` — Már telepítve van!

A rendszer mutatja mint elérhető skill. Magasabb szintű UI/UX döntésekhez, design critique-hoz.

### 2. Figma skills — Figma plugin

Ha Claude Design-ban tervezett UI-t szeretnél átvinni kódba:

```
figma:figma-use          — Figma file olvasás és komponens implementáció
figma:figma-code-connect — Figma → React komponens kapcsolat
```

Ezek a Figma MCP pluginon keresztül érhetők el.

### 3. `shadcn-claude-skill` — Már telepítve

Shadcn komponens setup és testreszabás részletesebb guidánce-szal.

---

## Hasznos Claude Code workflow-k ehhez a projekthez

### Feature implementáció workflow

```
1. /brainstorming  → mit kell pontosan csinálni?
2. /writing-plans  → részletes implementációs terv
3. /test-driven-development → tesztek először
4. (implementáció)
5. /verification-before-completion → tényleg működik?
6. /code-review → code quality check
```

### UI komponens workflow

```
1. /frontend-design → komponens megtervezése
2. /design-system → illeszkedik-e a design rendszerbe?
3. /fixing-accessibility → a11y check
4. /verification-before-completion → browser tesztelés
```

### AI workflow implementáció workflow

```
1. /writing-plans → a workflow lépései, input/output sémák
2. /test-driven-development → mock provider tesztekkel
3. /documentation-lookup → LiteLLM / PydanticAI docs
4. (implementáció)
5. /basic-security-check → API kulcs kezelés OK?
6. /verification-before-completion
```

---

## .claude/settings.json — manuálisan beállítandó

A projekt `.claude/settings.json` fájlba másold be:

```json
{
  "model": "claude-sonnet-4-6",
  "permissions": {
    "allow": [
      "Bash(pnpm *)",
      "Bash(turbo *)",
      "Bash(npx *)",
      "Bash(uvicorn *)",
      "Bash(alembic *)",
      "Bash(pytest *)",
      "Bash(uv *)",
      "Bash(docker compose *)",
      "Bash(ollama *)"
    ]
  }
}
```

> **Megjegyzés:** A `git commit` és `git push` szándékosan nincs az allow listán — ezeket mindig manuálisan erősítsd meg.

---

## Ajánlott VS Code extensions

```
bradlc.vscode-tailwindcss     — Tailwind IntelliSense
dbaeumer.vscode-eslint         — ESLint
esbenp.prettier-vscode         — Prettier
ms-python.python               — Python
ms-python.vscode-pylance       — Python types
charliermarsh.ruff             — Ruff linter
mtxr.sqltools                  — SQL tools
```
