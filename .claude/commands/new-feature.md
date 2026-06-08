Invoke the feature-dev skill to build a new ForgeWriter AI feature.

Feature request: $ARGUMENTS

Context:
- Project: ForgeWriter AI — local-first, agentic AI novel-writing workspace
- Stack: Next.js 15 + FastAPI + PostgreSQL + pgvector + Redis + RQ + LiteLLM + PydanticAI
- Monorepo: Turborepo + pnpm (apps/web, apps/api, packages/shared, packages/prompts)
- Design tokens: background #f8f6f2, accent #6d5dfc — see docs/superpowers/specs/2026-06-08-tech-stack-design.md
- Always check CLAUDE.md for MVP boundaries before implementing
- AI logic must go in apps/api/app/ai/ or apps/api/app/workflows/ - never in route handlers
- Prompt templates go in packages/prompts/ as versioned .txt files
