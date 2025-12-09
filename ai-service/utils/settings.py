import os
from functools import lru_cache

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class Settings(BaseModel):
  app_name: str = 'AI Screener - AI Service'
  environment: str = os.getenv('ENVIRONMENT', 'development')
  port: int = int(os.getenv('PORT', '8000'))
  allow_origins: list[str] = ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5000']
  ai_provider: str = os.getenv('AI_PROVIDER', 'mock')
  openai_api_key: str | None = os.getenv('OPENAI_API_KEY')
  llm_model_name: str = os.getenv('LLM_MODEL_NAME', 'gpt-4o-mini')
  llm_temperature: float = float(os.getenv('LLM_TEMPERATURE', '0.2'))
  llm_max_tokens: int = int(os.getenv('LLM_MAX_TOKENS', '600'))
  llm_timeout: float = float(os.getenv('LLM_TIMEOUT', '30'))
  embedding_model_name: str = os.getenv('EMBEDDING_MODEL_NAME', 'text-embedding-3-small')
  embedding_timeout: float = float(os.getenv('EMBEDDING_TIMEOUT', '30'))


@lru_cache
def get_settings() -> Settings:
  return Settings()

