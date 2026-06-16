from pathlib import Path

import pytest

from app.services.prompt_loader import PromptLoader


@pytest.fixture
def temp_prompts_dir(tmp_path):
    """Create a temporary prompts directory with test templates."""
    prompts_dir = tmp_path / "hu"
    prompts_dir.mkdir(parents=True)

    # Simple template
    (prompts_dir / "simple.md").write_text("Rendszer prompt\n---\nFelhasználó prompt", encoding="utf-8")

    # Template with variables
    (prompts_dir / "with_vars.md").write_text(
        "Rendszer: {system_var}\n---\nFelhasználó: {user_var}",
        encoding="utf-8",
    )

    # Template without separator
    (prompts_dir / "no_sep.md").write_text("Egyetlen szekció", encoding="utf-8")

    return prompts_dir


def test_load_returns_full_template(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    content = loader.load("simple")
    assert "Rendszer prompt" in content
    assert "Felhasználó prompt" in content


def test_load_with_variables(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    content = loader.load("with_vars", system_var="alma", user_var="körte")
    assert "alma" in content
    assert "körte" in content


def test_load_system_section(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    system = loader.load_system("simple")
    assert system == "Rendszer prompt"
    assert "Felhasználó prompt" not in system


def test_load_user_section(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    user = loader.load_user("simple")
    assert user == "Felhasználó prompt"
    assert "Rendszer prompt" not in user


def test_load_user_section_with_variable(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    user = loader.load_user("with_vars", system_var="x", user_var="hello")
    assert "hello" in user


def test_load_system_no_separator(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    system = loader.load_system("no_sep")
    assert system == "Egyetlen szekció"


def test_load_user_no_separator(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    user = loader.load_user("no_sep")
    assert user == "Egyetlen szekció"


def test_load_missing_template_raises(temp_prompts_dir):
    loader = PromptLoader(temp_prompts_dir)
    with pytest.raises(FileNotFoundError):
        loader.load("nonexistent")


def test_load_missing_variable_raises_valueerror_with_template_name(temp_prompts_dir):
    """FIX 5: a {placeholder} with no matching variable must raise a clear
    ValueError naming the template + the missing key — not a bare KeyError."""
    loader = PromptLoader(temp_prompts_dir)
    with pytest.raises(ValueError) as exc_info:
        # with_vars.md references {system_var} and {user_var}; omit user_var.
        loader.load("with_vars", system_var="x")
    msg = str(exc_info.value)
    assert "with_vars" in msg
    assert "user_var" in msg


def test_real_rewrite_template_exists():
    """Verify the actual Hungarian rewrite template exists and loads."""
    # Find the packages/prompts/hu directory relative to the test
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    hu_dir = repo_root / "packages" / "prompts" / "hu"
    if not hu_dir.exists():
        pytest.skip("packages/prompts/hu directory not found")
    loader = PromptLoader(hu_dir)
    # B2b added a {context} placeholder to the rewrite template; the loader's
    # .format requires every placeholder to be supplied.
    content = loader.load(
        "rewrite", selected_text="teszt", instruction="javítsd", context=""
    )
    assert "teszt" in content
    assert "javítsd" in content


def test_real_describe_template_exists():
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    hu_dir = repo_root / "packages" / "prompts" / "hu"
    if not hu_dir.exists():
        pytest.skip("packages/prompts/hu directory not found")
    loader = PromptLoader(hu_dir)
    content = loader.load("describe", selected_text="teszt szöveg", channel="Látás")
    assert "Látás" in content


def test_all_6_templates_exist():
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    hu_dir = repo_root / "packages" / "prompts" / "hu"
    if not hu_dir.exists():
        pytest.skip("packages/prompts/hu directory not found")
    loader = PromptLoader(hu_dir)
    for name in ["rewrite", "describe", "write_continue", "generate_scene", "summarize", "continuity_check"]:
        path = hu_dir / f"{name}.md"
        assert path.exists(), f"Missing template: {name}.md"


def test_continuity_check_system_section_has_no_placeholders():
    """B3: the restructured continuity_check.md system section (before ---) must
    carry NO {placeholders}, so load_system() (called with NO vars) does not leak
    literal '{codex_context}' / '{content}' into the system prompt."""
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    hu_dir = repo_root / "packages" / "prompts" / "hu"
    if not hu_dir.exists():
        pytest.skip("packages/prompts/hu directory not found")
    loader = PromptLoader(hu_dir)
    system = loader.load_system("continuity_check")
    assert "{codex_context}" not in system
    assert "{content}" not in system
    # The system section is pure instructions (the JSON example lives in the user
    # section), so there must be NO leftover brace placeholders at all.
    assert "{" not in system and "}" not in system


def test_continuity_check_user_section_renders_both_placeholders():
    """B3: both {codex_context} and {content} live in the user section and render
    via load_user(); the escaped JSON example renders as real single braces."""
    repo_root = Path(__file__).parent.parent.parent.parent.parent
    hu_dir = repo_root / "packages" / "prompts" / "hu"
    if not hu_dir.exists():
        pytest.skip("packages/prompts/hu directory not found")
    loader = PromptLoader(hu_dir)
    user = loader.load_user(
        "continuity_check",
        codex_context="KODEX-JELZO",
        content="JELENET-JELZO",
    )
    assert "KODEX-JELZO" in user
    assert "JELENET-JELZO" in user
    # No literal placeholders left.
    assert "{codex_context}" not in user
    assert "{content}" not in user
    # The escaped example braces ({{ }}) rendered to real single braces, so the
    # model sees a valid JSON example, not doubled braces.
    assert '{"severity"' in user
    assert "{{" not in user


def test_module_level_singleton_exists():
    from app.services.prompt_loader import prompt_loader
    assert isinstance(prompt_loader, PromptLoader)
