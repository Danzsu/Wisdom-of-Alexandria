from pathlib import Path


class PromptLoader:
    """Loads and renders prompt templates from the prompts directory."""

    def __init__(self, prompts_dir: str | Path | None = None):
        if prompts_dir is None:
            # Default: relative to repo root — works both locally and in Docker
            # Docker mounts packages/prompts at /app/prompts
            default = Path("/app/prompts/hu")
            if not default.exists():
                # Fallback for local dev: 5 parents from
                # apps/ai/app/services/prompt_loader.py lands on the repo root.
                repo_root = Path(__file__).parent.parent.parent.parent.parent
                default = repo_root / "packages" / "prompts" / "hu"
            self.prompts_dir = default
        else:
            self.prompts_dir = Path(prompts_dir)

    def load(self, template_name: str, **variables: str) -> str:
        """Load a prompt template and substitute variables.

        Template files use {variable_name} syntax.
        Example: load("rewrite", selected_text="...", instruction="...")
        """
        path = self.prompts_dir / f"{template_name}.md"
        if not path.exists():
            raise FileNotFoundError(f"Prompt template not found: {path}")
        template = path.read_text(encoding="utf-8")
        if variables:
            try:
                template = template.format(**variables)
            except KeyError as e:
                # A {placeholder} in the template has no matching variable.
                # Surface the template name + missing key instead of a bare,
                # context-free KeyError.
                raise ValueError(
                    f"Prompt template '{template_name}' missing variable: {e!r}"
                ) from e
        return template

    def load_system(self, template_name: str, **variables: str) -> str:
        """Load only the system section (everything before the first --- separator)."""
        content = self.load(template_name, **variables)
        parts = content.split("---", 1)
        return parts[0].strip()

    def load_user(self, template_name: str, **variables: str) -> str:
        """Load only the user section (everything after the first --- separator)."""
        content = self.load(template_name, **variables)
        parts = content.split("---", 1)
        if len(parts) < 2:
            return content.strip()
        return parts[1].strip()


# Module-level singleton
prompt_loader = PromptLoader()
