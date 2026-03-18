from __future__ import annotations

import hashlib
from dataclasses import dataclass
from typing import List

import numpy as np

from utils.settings import get_settings


def cosine_similarity(a: List[float], b: List[float]) -> float:
  if not a or not b:
    return 0.0
  va = np.array(a, dtype=float)
  vb = np.array(b, dtype=float)
  denom = float(np.linalg.norm(va) * np.linalg.norm(vb))
  if denom == 0.0:
    return 0.0
  return float(np.dot(va, vb) / denom)


@dataclass
class EmbeddingsClient:
  """Deterministic, offline embeddings implementation."""

  dim: int = 64

  def embed(self, texts: List[str]) -> List[List[float]]:
    vectors: List[List[float]] = []
    for t in texts:
      digest = hashlib.sha256((t or '').encode('utf-8')).digest()
      arr = np.frombuffer(digest, dtype=np.uint8).astype(float)
      arr = (arr - 127.5) / 127.5
      if arr.size < self.dim:
        arr = np.pad(arr, (0, self.dim - arr.size))
      else:
        arr = arr[: self.dim]
      vectors.append(arr.tolist())
    return vectors


def get_embeddings_client() -> EmbeddingsClient:
  _ = get_settings()
  return EmbeddingsClient()
