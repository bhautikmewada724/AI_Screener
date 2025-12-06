from __future__ import annotations

import hashlib
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Final

try:
  from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
  OpenAI = None  # type: ignore

from utils.settings import get_settings


class LLMClient(ABC):
  """Abstract interface for running free-form prompts against an LLM."""

  @abstractmethod
  def run(self, prompt: str, *, temperature: float | None = None, system_prompt: str | None = None) -> str:
    raise NotImplementedError


class MockLLMClient(LLMClient):
  """Deterministic mock client that echoes the prompt for contract stability."""

  def run(self, prompt: str, *, temperature: float | None = None, system_prompt: str | None = None) -> str:  # noqa: ARG002
    digest = hashlib.sha256(prompt.encode('utf-8')).hexdigest()[:12]
    return f"[mock-llm:{digest}] {prompt[:200]}"


class OpenAILLMClient(LLMClient):
  """Thin wrapper around OpenAI's Chat Completions API."""

  def __init__(self, api_key: str, model: str, default_temperature: float) -> None:
    if not OpenAI:
      raise RuntimeError('openai package is not installed. Install optional dependencies to enable providers.')

    self._client = OpenAI(api_key=api_key)
    self._model: Final[str] = model
    self._default_temperature: Final[float] = default_temperature

  def run(self, prompt: str, *, temperature: float | None = None, system_prompt: str | None = None) -> str:
    response = self._client.chat.completions.create(
      model=self._model,
      temperature=temperature if temperature is not None else self._default_temperature,
      messages=[
        {'role': 'system', 'content': system_prompt or 'You are a precise assistant for resume parsing.'},
        {'role': 'user', 'content': prompt}
      ],
      max_tokens=600
    )

    choice = response.choices[0]
    return (choice.message.content or '').strip()


@lru_cache
def get_llm_client() -> LLMClient:
  """Return the configured LLM client for the current environment."""

  settings = get_settings()
  provider = settings.ai_provider.lower()

  if provider == 'openai':
    if not settings.openai_api_key:
      raise RuntimeError('OPENAI_API_KEY is required when AI_PROVIDER=openai')
    return OpenAILLMClient(
      api_key=settings.openai_api_key,
      model=settings.llm_model_name,
      default_temperature=settings.llm_temperature
    )

  return MockLLMClient()

