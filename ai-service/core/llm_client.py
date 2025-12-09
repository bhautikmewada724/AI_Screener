from __future__ import annotations

import hashlib
import logging
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Final

try:
  from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
  OpenAI = None  # type: ignore

from utils.settings import get_settings

logger = logging.getLogger(__name__)


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

  def __init__(self, api_key: str, model: str, default_temperature: float, *, max_tokens: int, timeout: float) -> None:
    if not OpenAI:
      raise RuntimeError('openai package is not installed. Install optional dependencies to enable providers.')

    self._client = OpenAI(api_key=api_key)
    self._model: Final[str] = model
    self._default_temperature: Final[float] = default_temperature
    self._max_tokens: Final[int] = max_tokens
    self._timeout: Final[float] = timeout

  def run(self, prompt: str, *, temperature: float | None = None, system_prompt: str | None = None) -> str:
    resolved_temperature = temperature if temperature is not None else self._default_temperature
    last_error: Exception | None = None

    for attempt in range(2):
      try:
        response = self._client.chat.completions.create(
          model=self._model,
          temperature=resolved_temperature,
          messages=[
            {'role': 'system', 'content': system_prompt or 'You are a precise assistant for resume parsing.'},
            {'role': 'user', 'content': prompt}
          ],
          max_tokens=self._max_tokens,
          timeout=self._timeout
        )
        choice = response.choices[0]
        return (choice.message.content or '').strip()
      except Exception as exc:  # noqa: BLE001
        last_error = exc
        logger.warning('LLM call failed (attempt %s/2): %s', attempt + 1, exc)

    assert last_error is not None
    raise last_error


@lru_cache
def get_llm_client() -> LLMClient:
  """Return the configured LLM client for the current environment."""

  settings = get_settings()
  provider = settings.ai_provider.lower().strip()

  if provider == 'openai':
    if not settings.openai_api_key:
      logger.warning('OPENAI_API_KEY is missing; falling back to mock LLM client.')
    elif not OpenAI:
      logger.warning('openai package unavailable; falling back to mock LLM client.')
    else:
      return OpenAILLMClient(
        api_key=settings.openai_api_key,
        model=settings.llm_model_name,
        default_temperature=settings.llm_temperature,
        max_tokens=settings.llm_max_tokens,
        timeout=settings.llm_timeout
      )

  if provider != 'mock':
    logger.warning('Unknown AI_PROVIDER "%s"; defaulting to mock LLM client.', provider)

  return MockLLMClient()

