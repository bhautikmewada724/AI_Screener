from __future__ import annotations

import uuid
from typing import Any, Optional


def ensure_request_id(candidate: Optional[str]) -> str:
  token = str(candidate or '').strip()
  return token or f'req-{uuid.uuid4()}'


def truncate_text(value: Optional[str], limit: int) -> Optional[str]:
  if value is None:
    return None
  if len(value) <= limit:
    return value
  return f"{value[:limit]}…[truncated]"


def coerce_bool(flag: Any) -> bool:
  if isinstance(flag, bool):
    return flag
  if flag is None:
    return False
  if isinstance(flag, (int, float)):
    return bool(flag)
  lowered = str(flag).strip().lower()
  return lowered in {'1', 'true', 'yes', 'on'}

