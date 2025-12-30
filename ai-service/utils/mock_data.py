from __future__ import annotations

from datetime import datetime, timezone


def timestamp() -> str:
  # ISO8601 UTC timestamp
  return datetime.now(timezone.utc).isoformat()
