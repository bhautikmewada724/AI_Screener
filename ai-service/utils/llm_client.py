from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from utils.settings import get_settings


@dataclass
class LLMClient:
  """Minimal LLM client abstraction."""

  def run(self, prompt: str, temperature: float = 0.2, system_prompt: Optional[str] = None) -> str:
    settings = get_settings()
    if settings.ai_provider.lower().strip() == 'mock' or not settings.openai_api_key:
      # Offline fallback: return a compact summary-like slice of the prompt.
      lines = [ln.strip() for ln in prompt.splitlines() if ln.strip()]
      return ' '.join(lines[:3])[:300]
    raise RuntimeError('Live LLM calls disabled in this environment.')


def get_llm_client() -> LLMClient:
  return LLMClient()
