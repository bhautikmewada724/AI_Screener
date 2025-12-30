from __future__ import annotations

import os
from functools import lru_cache
from typing import List

from pydantic import BaseModel


class Settings(BaseModel):
  environment: str = os.getenv('ENVIRONMENT', 'dev')
  allow_origins: List[str] = (
    os.getenv('ALLOW_ORIGINS', '*').split(',') if os.getenv('ALLOW_ORIGINS') else ['*']
  )
  ai_provider: str = os.getenv('AI_PROVIDER', 'mock')
  openai_api_key: str = os.getenv('OPENAI_API_KEY', '')

  openai_chat_model: str = os.getenv('OPENAI_CHAT_MODEL', 'gpt-4o-mini')
  openai_embedding_model: str = os.getenv('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small')


@lru_cache(maxsize=1)
def get_settings() -> Settings:
  return Settings()
