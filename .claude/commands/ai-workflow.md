Design and implement a new AI workflow for ForgeWriter AI.

Workflow to implement: $ARGUMENTS

Architecture rules:
- All AI workflows live in apps/api/app/workflows/
- Each workflow is a separate file: <name>_workflow.py
- Input/output must be typed Pydantic models (in apps/api/app/schemas/)
- Use LiteLLM for direct inference calls (MVP), PydanticAI agents for V1+
- Prompt templates go in packages/prompts/<workflow>.v1.txt — never hardcoded
- Every generation must record: source_inputs, model_name, prompt_version, output, review_status
- Background execution via RQ job in apps/api/app/workers/jobs/
- Always save previous version before overwriting manuscript text

MVP workflows (direct LiteLLM):
- rewrite_text — rewrite selected passage
- generate_scene — scene draft from beat list
- check_continuity — scan scene against Codex

V1 workflows (PydanticAI agents):
- scene_writer_agent
- continuity_checker_agent
- hungarian_editor_agent
- brainstorm_agent
