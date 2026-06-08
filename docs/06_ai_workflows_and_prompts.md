# 06 — AI Workflows and Prompt Contracts

## Purpose

This document defines the controlled AI workflows for the agentic AI novel-writing platform.

The system must not behave like a generic chatbot. AI features should operate inside structured writing workflows:

- brainstorming
- planning
- scene drafting
- rewriting
- style editing
- Hungarian language polish
- continuity checking
- developmental editing
- export formatting

## Core AI principles

1. Human remains in control.
2. AI output is never inserted into manuscript without approval.
3. Every AI operation creates a GenerationJob.
4. Every accepted AI edit creates a Revision.
5. Writer and reviewer roles should be separated.
6. Codex and scene context should be retrieved explicitly.
7. Hungarian naturalness is a first-class quality requirement.
8. Prompt templates must be versioned.
9. Model routing must be configurable.

## Model routing

### Model tiers

```txt
local_draft_model
  Use for brainstorming, rough scene draft, simple rewrite.

cloud_review_model
  Use for critique, style polish, Hungarian naturalness, long-context checks.

embedding_model
  Use for Codex and manuscript retrieval.
```

### Routing rules

| Task | Default model | Reason |
|---|---|---|
| Brainstorm | local_draft_model | cheap, iterative |
| Character idea | local_draft_model | low risk |
| Scene beat generation | local_draft_model | structured output |
| Scene first draft | local_draft_model | high volume |
| Rewrite selected text | local_draft_model | fast |
| Dialogue improvement | local_draft_model or cloud_review_model | depends on quality need |
| Hungarian polish | cloud_review_model preferred | language nuance |
| Continuity check | local + RAG first, cloud optional | accuracy matters |
| Developmental edit | cloud_review_model | higher reasoning quality |
| Final polish | cloud_review_model | quality-critical |
| Export formatting | deterministic, no LLM needed | avoid hallucination |

## Context assembly

Every AI workflow should assemble context in layers.

### Context layers

```txt
1. System role and quality rules
2. Project metadata
3. Book metadata
4. Style guide
5. Relevant Codex entries
6. Chapter summary
7. Previous scene summary
8. Current scene metadata
9. Beats / user instruction
10. Selected manuscript text
```

### Context limits

If context is too long, prioritize:

1. current scene
2. current instruction
3. relevant characters
4. relevant locations
5. relevant worldbuilding rules
6. style guide
7. previous scene summary
8. chapter summary
9. broader book synopsis

## Output format rules

For structured workflows, prefer JSON output.

For creative prose generation, output Markdown prose plus metadata.

All JSON outputs must be parseable.

## Workflow 1 — Brainstorm

### Goal

Generate creative options without committing them to the manuscript.

### Input

```json
{
  "project_id": "uuid",
  "topic": "betrayal scene ideas",
  "constraints": ["must involve Anna", "should happen before chapter 5"],
  "tone": "dark, intimate, literary",
  "count": 8
}
```

### Output

```json
{
  "ideas": [
    {
      "title": "Idea title",
      "summary": "Short explanation",
      "potential_conflict": "Conflict",
      "risk": "Possible cliché or continuity risk"
    }
  ]
}
```

### Prompt template

```txt
You are a creative fiction brainstorming assistant.

Language: Hungarian.
Genre: {{genre}}.
Tone: {{tone}}.

Use the provided Codex only as context. Do not contradict it.
Generate {{count}} distinct ideas for: {{topic}}.

Constraints:
{{constraints}}

Relevant Codex:
{{codex_context}}

Return valid JSON only:
{
  "ideas": [
    {
      "title": "...",
      "summary": "...",
      "potential_conflict": "...",
      "risk": "..."
    }
  ]
}
```

## Workflow 2 — Rewrite selected text

### Goal

Rewrite a selected manuscript passage while preserving meaning and context.

### Actions

```txt
rewrite_naturally
make_more_literary
make_more_tense
improve_dialogue
show_dont_tell
expand
compress
improve_hungarian_style
```

### Input

```json
{
  "selected_text": "...",
  "action": "improve_hungarian_style",
  "scene_context": "...",
  "style_guide": "...",
  "custom_instruction": "Make it less explanatory."
}
```

### Output

```json
{
  "rewritten_text": "...",
  "explanation": "...",
  "changed_aspects": ["dialogue", "rhythm", "word choice"],
  "warnings": []
}
```

### Prompt template

```txt
You are a Hungarian literary editor.

Task: {{action}}.

Preserve:
- meaning
- continuity
- character intention
- narrative POV
- tense

Improve:
- natural Hungarian phrasing
- rhythm
- clarity
- emotional precision
- dialogue realism when applicable

Avoid:
- English-like sentence structures
- overexplaining
- melodrama
- repeated sentence openings
- inconsistent tegezés/magázás
- changing facts from the Codex

Scene context:
{{scene_context}}

Style guide:
{{style_guide}}

Selected text:
{{selected_text}}

Custom instruction:
{{custom_instruction}}

Return valid JSON:
{
  "rewritten_text": "...",
  "explanation": "...",
  "changed_aspects": [],
  "warnings": []
}
```

## Workflow 3 — Chapter planner

### Goal

Generate a chapter outline from plotline, Codex, and book state.

### Input

```json
{
  "book_id": "uuid",
  "chapter_goal": "...",
  "plotline_context": "...",
  "target_scene_count": 4
}
```

### Output

```json
{
  "chapter_title_options": [],
  "chapter_summary": "...",
  "scenes": [
    {
      "title": "...",
      "pov_character": "...",
      "location": "...",
      "goal": "...",
      "conflict": "...",
      "outcome": "...",
      "emotional_turn": "..."
    }
  ],
  "continuity_risks": []
}
```

### Prompt template

```txt
You are a story architect for a long-form Hungarian novel.

Design a chapter plan that advances the plot and respects the Codex.

Book synopsis:
{{book_synopsis}}

Previous chapter summary:
{{previous_chapter_summary}}

Chapter goal:
{{chapter_goal}}

Plotline context:
{{plotline_context}}

Relevant Codex:
{{codex_context}}

Target scene count: {{target_scene_count}}

Return valid JSON with:
- chapter title options
- chapter summary
- scene list
- continuity risks
```

## Workflow 4 — Scene writer

### Goal

Generate a first-draft scene from beats.

### Input

```json
{
  "scene_id": "uuid",
  "target_word_count": 1800,
  "beats": [],
  "pov_character": "Anna",
  "location": "Old train station",
  "style_guide": {}
}
```

### Output

```json
{
  "draft_markdown": "...",
  "scene_summary": "...",
  "used_codex_entries": [],
  "continuity_warnings": [],
  "style_notes": []
}
```

### Prompt template

```txt
You are a Hungarian fiction writer drafting a scene.

Write in Hungarian.
Do not explain the story. Write the scene itself.
Use natural, literary but readable prose.
Maintain the selected POV and tense.
Avoid generic AI prose.

Scene metadata:
{{scene_metadata}}

Target word count: {{target_word_count}}

POV character:
{{pov_character_profile}}

Location:
{{location_profile}}

Relevant characters:
{{character_context}}

Relevant lore:
{{worldbuilding_context}}

Style guide:
{{style_guide}}

Beats to cover in order:
{{beats}}

Previous scene summary:
{{previous_scene_summary}}

Requirements:
- Follow all beats.
- Do not contradict the Codex.
- Keep dialogue natural.
- Avoid overexplaining emotions.
- Use concrete sensory details.
- End with the required scene outcome.
- Do not add major new lore unless requested.

Return valid JSON:
{
  "draft_markdown": "...",
  "scene_summary": "...",
  "used_codex_entries": [],
  "continuity_warnings": [],
  "style_notes": []
}
```

## Workflow 5 — Continuity checker

### Goal

Detect contradictions between a scene/chapter and the Codex or previous summaries.

### Input

```json
{
  "text": "...",
  "codex_context": "...",
  "previous_summaries": "..."
}
```

### Output

```json
{
  "issues": [
    {
      "type": "character|location|timeline|lore|plot",
      "severity": "info|warning|major|critical",
      "quote": "...",
      "problem": "...",
      "suggested_fix": "...",
      "related_codex_entries": []
    }
  ],
  "overall_risk": "low|medium|high"
}
```

### Prompt template

```txt
You are a continuity editor.

Check the manuscript text against the Codex and previous summaries.
Do not rewrite the text.
Find contradictions, missing setup, impossible timeline jumps, character voice breaks, and lore conflicts.

Codex:
{{codex_context}}

Previous summaries:
{{previous_summaries}}

Text to check:
{{text}}

Return valid JSON:
{
  "issues": [
    {
      "type": "...",
      "severity": "...",
      "quote": "...",
      "problem": "...",
      "suggested_fix": "...",
      "related_codex_entries": []
    }
  ],
  "overall_risk": "..."
}
```

## Workflow 6 — Hungarian language editor

### Goal

Improve Hungarian fluency and style without changing story facts.

### Checks

- angolos szerkezetek
- természetellenes párbeszéd
- túlírt mondatok
- ismétlések
- modorosság
- túlmagyarázás
- következetlen tegezés/magázás
- hangnem törés
- túl direkt érzelemleírás

### Output

```json
{
  "edited_text": "...",
  "language_issues": [
    {
      "type": "...",
      "original": "...",
      "replacement": "...",
      "reason": "..."
    }
  ],
  "notes": []
}
```

### Prompt template

```txt
You are a professional Hungarian literary language editor.

Improve the Hungarian prose while preserving:
- meaning
- facts
- POV
- tense
- character voice
- scene outcome

Focus on:
- natural Hungarian syntax
- rhythm
- dialogue authenticity
- removing English-like phrasing
- reducing overexplanation
- improving literary readability

Do not add new plot events.

Text:
{{text}}

Style guide:
{{style_guide}}

Return valid JSON:
{
  "edited_text": "...",
  "language_issues": [],
  "notes": []
}
```

## Workflow 7 — Developmental editor

### Goal

Review a chapter or scene for narrative quality.

### Checks

- pacing
- tension
- character motivation
- scene purpose
- conflict strength
- emotional arc
- ending hook
- redundancy
- missing setup/payoff

### Output

```json
{
  "overall_assessment": "...",
  "strengths": [],
  "issues": [],
  "recommended_changes": [],
  "score": {
    "pacing": 1,
    "tension": 1,
    "clarity": 1,
    "emotional_impact": 1,
    "continuity": 1
  }
}
```

## Workflow 8 — Agentic chapter pipeline

### Goal

Generate and review a chapter through multiple controlled steps.

### Graph

```txt
Input chapter goal
  ↓
Chapter Planner Agent
  ↓
Human approve outline
  ↓
Scene Beat Agent
  ↓
Human approve beats
  ↓
Scene Writer Agent
  ↓
Continuity Checker Agent
  ↓
Hungarian Style Editor Agent
  ↓
Developmental Editor Agent
  ↓
Human review
  ↓
Save accepted draft
  ↓
Summary Agent updates memory
```

### Human approval gates

Required approval after:

- chapter outline
- scene beats
- generated draft
- major rewrite
- final polish

## Workflow 9 — Summary memory

### Goal

After a scene/chapter is accepted, create a summary for future context retrieval.

### Scene summary fields

```json
{
  "scene_id": "uuid",
  "summary": "...",
  "characters_present": [],
  "location": "...",
  "new_facts": [],
  "character_state_changes": [],
  "plot_advancement": [],
  "open_questions": []
}
```

### Chapter summary fields

```json
{
  "chapter_id": "uuid",
  "summary": "...",
  "major_events": [],
  "character_changes": [],
  "timeline_updates": [],
  "new_lore": [],
  "unresolved_threads": []
}
```

## Prompt versioning

Every prompt template should include:

```txt
prompt_id
version
task_type
created_at
description
template
expected_output_schema
```

## Prompt storage

Suggested folder:

```txt
packages/prompts/
  brainstorm.v1.txt
  rewrite.v1.txt
  chapter_planner.v1.txt
  scene_writer.v1.txt
  continuity_checker.v1.txt
  hungarian_editor.v1.txt
  developmental_editor.v1.txt
  summary_memory.v1.txt
```

## Logging

For each AI call, store:

- job_id
- model provider
- model name
- prompt template version
- input token estimate
- output token estimate
- retrieved context IDs
- raw response
- parsed response
- error if any

## MVP AI features

Only implement these first:

1. rewrite selected text
2. improve Hungarian style
3. generate scene from beats
4. basic continuity checker
5. summary memory after accepting a draft
