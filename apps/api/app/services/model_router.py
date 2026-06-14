from dataclasses import dataclass
from typing import Any

import litellm
from litellm import acompletion

from app.core.config import settings


@dataclass
class ModelResponse:
    content: str
    model: str
    usage: dict[str, int]


class ModelRouter:
    """Central LiteLLM abstraction. All AI calls go through this."""

    def __init__(self, base_url: str | None = None, default_model: str | None = None):
        self.base_url = base_url or settings.ollama_base_url
        self.default_model = default_model or settings.default_local_model

    async def complete(
        self,
        messages: list[dict[str, str]],
        model: str | None = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs: Any,
    ) -> ModelResponse:
        resolved_model = model or self.default_model
        response = await acompletion(
            model=resolved_model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            api_base=self.base_url if resolved_model.startswith("ollama/") else None,
            **kwargs,
        )
        content = response.choices[0].message.content or ""
        usage = {
            "prompt_tokens": getattr(response.usage, "prompt_tokens", 0) or 0,
            "completion_tokens": getattr(response.usage, "completion_tokens", 0) or 0,
            "total_tokens": getattr(response.usage, "total_tokens", 0) or 0,
        }
        return ModelResponse(content=content, model=resolved_model, usage=usage)

    def build_messages(self, system: str, user: str) -> list[dict[str, str]]:
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ]


# Module-level singleton — import and use directly in services
model_router = ModelRouter()
