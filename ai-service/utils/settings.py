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


@lru_cache
def get_settings() -> Settings:
  return Settings()

