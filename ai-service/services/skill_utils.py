from __future__ import annotations

import os
import re
from typing import Dict, List, Set, Tuple

from utils.skill_ontology_loader import (
  OntologyEntry,
  get_skill_ontology,
  record_unknown_skill,
  resolve_alias_to_canonical,
  similarity_to_canonical
)


def normalize_token(token: str) -> str:
  cleaned = re.sub(r'[^a-z0-9+/# .-]+', ' ', token.lower())
  cleaned = cleaned.replace('node.js', 'nodejs').replace('node js', 'nodejs')
  cleaned = re.sub(r'\brest\s+apis?\b', 'rest api', cleaned)
  cleaned = re.sub(r'\s+', ' ', cleaned).strip()
  return cleaned


def _dedupe_preserve(items: List[str]) -> List[str]:
  seen = set()
  out = []
  for item in items:
    key = item.lower()
    if key in seen:
      continue
    seen.add(key)
    out.append(item)
  return out


def _match_alias_or_ontology(raw: str) -> Tuple[str | None, OntologyEntry | None]:
  ontology = get_skill_ontology()
  alias_match = resolve_alias_to_canonical(raw)
  if alias_match:
    return alias_match.displayName, alias_match

  threshold = float(os.getenv('SKILL_EMBED_THRESHOLD', '0.82'))
  sim_match = similarity_to_canonical(raw, threshold=threshold)
  if sim_match:
    return sim_match.displayName, sim_match
  return None, None


def extract_skills(text: str, max_results: int | None = None) -> List[str]:
  """Return canonicalized skills found within free-form text using open vocabulary."""

  normalized_text = normalize_token(text)
  tokens = re.findall(r'[a-z0-9+/#.-]{2,}', normalized_text)

  candidates: List[str] = []
  for token in tokens:
    token = token.strip('.- ')
    if not token:
      continue
    candidates.append(token)

  # Also capture multi-word phrases separated by commas/newlines
  candidates.extend([part.strip() for part in re.split(r'[,\n;]+', normalized_text) if part.strip()])

  normalized: List[str] = []
  for cand in candidates:
    canonical, _entry = _match_alias_or_ontology(cand)
    if canonical:
      normalized.append(canonical)
    else:
      normalized.append(cand.strip())
      record_unknown_skill(cand.strip())

  ordered = _dedupe_preserve(normalized)
  if max_results is not None:
    return ordered[:max_results]
  return ordered


def normalize_skill_list(skills: List[str]) -> List[str]:
  """Deduplicate and consistently format arbitrary skill strings (ontology + embeddings)."""

  normalized: List[str] = []
  seen: Set[str] = set()

  for skill in skills:
    canonical, entry = _match_alias_or_ontology(skill)
    target = canonical or skill.strip()
    key = target.lower()
    if not key:
      continue
    if key in seen:
      continue
    seen.add(key)
    normalized.append(target if canonical else target)
    if not entry:
      record_unknown_skill(target)

  return normalized


def aliases_for(canon: str) -> List[str]:
  ontology = get_skill_ontology()
  entry = ontology.by_display.get(canon) or ontology.by_id.get(canon)
  if not entry:
    return []
  return sorted(set(entry.aliases or []))

