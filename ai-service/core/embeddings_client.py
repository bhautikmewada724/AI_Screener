from __future__ import annotations

import hashlib
import logging
import math
from abc import ABC, abstractmethod
from functools import lru_cache
from typing import Final, Iterable

try:
  from openai import OpenAI
except ImportError:  # pragma: no cover - optional dependency
  OpenAI = None  # type: ignore

from utils.settings import get_settings

logger = logging.getLogger(__name__)


class EmbeddingsClient(ABC):
  """Abstract interface for turning text into high-dimensional vectors."""

  @abstractmethod
  def embed(self, texts: Iterable[str]) -> list[list[float]]:
    raise NotImplementedError


class MockEmbeddingsClient(EmbeddingsClient):
  """Deterministic hash-based embeddings useful for local/dev flows."""

  def __init__(self, dimension: int = 32) -> None:
    self._dimension: Final[int] = dimension

  def embed(self, texts: Iterable[str]) -> list[list[float]]:
    vectors: list[list[float]] = []
    for text in texts:
      digest = hashlib.sha256(text.encode('utf-8')).digest()
      vector = []
      for i in range(self._dimension):
        byte = digest[i % len(digest)]
        # Scale to [-1, 1] to resemble cosine-friendly embeddings.
        vector.append((byte / 255.0) * 2 - 1)
      vectors.append(vector)
    return vectors


class OpenAIEmbeddingsClient(EmbeddingsClient):
  """Wrapper around OpenAI's embedding API."""

  def __init__(self, api_key: str, model: str, *, timeout: float) -> None:
    if not OpenAI:
      raise RuntimeError('openai package is not installed. Install optional dependencies to enable providers.')

    self._client = OpenAI(api_key=api_key)
    self._model: Final[str] = model
    self._timeout: Final[float] = timeout

  def embed(self, texts: Iterable[str]) -> list[list[float]]:
    text_list = list(texts)
    if not text_list:
      return []

    try:
      response = self._client.embeddings.create(
        model=self._model,
        input=text_list,
        timeout=self._timeout
      )
    except Exception as exc:  # noqa: BLE001
      logger.warning('Embedding generation failed: %s', exc)
      return []

    return [datum.embedding for datum in response.data]


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
  """Utility helper for downstream matching logic."""

  if not vec_a or not vec_b or len(vec_a) != len(vec_b):
    return 0.0

  dot = sum(a * b for a, b in zip(vec_a, vec_b))
  norm_a = math.sqrt(sum(a * a for a in vec_a))
  norm_b = math.sqrt(sum(b * b for b in vec_b))
  if not norm_a or not norm_b:
    return 0.0
  return dot / (norm_a * norm_b)


@lru_cache
def get_embeddings_client() -> EmbeddingsClient:
  """Return the configured embeddings provider."""

  settings = get_settings()
  provider = settings.ai_provider.lower().strip()

  if provider == 'openai':
    if not settings.openai_api_key:
      logger.warning('OPENAI_API_KEY is missing; falling back to mock embeddings client.')
    elif not OpenAI:
      logger.warning('openai package unavailable; falling back to mock embeddings client.')
    else:
      return OpenAIEmbeddingsClient(
        api_key=settings.openai_api_key,
        model=settings.embedding_model_name,
        timeout=settings.embedding_timeout
      )

  if provider != 'mock':
    logger.warning('Unknown AI_PROVIDER "%s"; defaulting to mock embeddings client.', provider)

  return MockEmbeddingsClient()

