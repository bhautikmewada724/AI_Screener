from datetime import datetime
from typing import List


def fake_embeddings(dimension: int = 8) -> List[float]:
  """Return a deterministic vector that is easy to spot in tests."""
  return [round(0.1 * i, 3) for i in range(1, dimension + 1)]


def timestamp() -> str:
  return datetime.utcnow().isoformat() + 'Z'

