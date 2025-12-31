from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Optional

from utils.embeddings_client import cosine_similarity, get_embeddings_client


@dataclass
class OntologyEntry:
  canonicalId: str
  displayName: str
  aliases: List[str] = field(default_factory=list)
  category: Optional[str] = None
  updatedAt: Optional[str] = None


@dataclass
class SkillOntology:
  entries: List[OntologyEntry]
  by_id: Dict[str, OntologyEntry]
  by_display: Dict[str, OntologyEntry]
  alias_to_entry: Dict[str, OntologyEntry]
  embeddings: Dict[str, List[float]]


_CACHE: SkillOntology | None = None
_UNKNOWN_COUNTS: Dict[str, int] = {}
_EMBED_CLIENT = get_embeddings_client()


def _default_paths():
  root = Path(__file__).resolve().parents[1]
  data_dir = root / 'data'
  return data_dir, data_dir / 'skill_ontology.json', data_dir / 'unknown_skills.json'


def _load_json(path: Path) -> List[dict]:
  if not path.exists():
    return []
  with path.open('r', encoding='utf-8') as f:
    return json.load(f) or []


def _write_unknown_counts(path: Path):
  try:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', encoding='utf-8') as f:
      json.dump(_UNKNOWN_COUNTS, f, ensure_ascii=False, indent=2)
  except Exception:
    # best-effort; do not break scoring
    pass


def _embed(texts: List[str]) -> Dict[str, List[float]]:
  vectors = _EMBED_CLIENT.embed(texts)
  return {text: vec for text, vec in zip(texts, vectors)}


def load_skill_ontology(force_reload: bool = False) -> SkillOntology:
  global _CACHE
  if _CACHE and not force_reload:
    return _CACHE

  data_dir, ontology_path, unknown_path = _default_paths()
  overrides = os.getenv('SKILL_ONTOLOGY_PATH')
  if overrides:
    ontology_path = Path(overrides)

  raw_entries = _load_json(ontology_path)
  entries: List[OntologyEntry] = []
  for item in raw_entries:
    try:
      entries.append(
        OntologyEntry(
          canonicalId=item.get('canonicalId') or item.get('id') or item.get('displayName'),
          displayName=item.get('displayName') or item.get('canonicalId'),
          aliases=item.get('aliases') or [],
          category=item.get('category'),
          updatedAt=item.get('updatedAt')
        )
      )
    except Exception:
      continue

  by_id = {e.canonicalId: e for e in entries if e.canonicalId}
  by_display = {e.displayName: e for e in entries if e.displayName}
  alias_to_entry: Dict[str, OntologyEntry] = {}
  for e in entries:
    for alias in e.aliases or []:
      alias_to_entry[alias.lower()] = e
    if e.displayName:
      alias_to_entry[e.displayName.lower()] = e
    if e.canonicalId:
      alias_to_entry[e.canonicalId.lower()] = e

  texts = list(by_display.keys()) + list(alias_to_entry.keys())
  embeddings = _embed(texts) if texts else {}

  # load unknown counts
  _UNKNOWN_COUNTS.clear()
  unknown_path_env = os.getenv('UNKNOWN_SKILLS_PATH')
  if unknown_path_env:
    unknown_path = Path(unknown_path_env)
  if unknown_path.exists():
    try:
      with unknown_path.open('r', encoding='utf-8') as f:
        data = json.load(f) or {}
        if isinstance(data, dict):
          for k, v in data.items():
            if isinstance(v, int):
              _UNKNOWN_COUNTS[k] = v
    except Exception:
      _UNKNOWN_COUNTS.clear()

  _CACHE = SkillOntology(entries, by_id, by_display, alias_to_entry, embeddings)
  return _CACHE


def get_skill_ontology() -> SkillOntology:
  return load_skill_ontology()


def resolve_alias_to_canonical(raw: str) -> OntologyEntry | None:
  ontology = get_skill_ontology()
  key = (raw or '').lower().strip()
  return ontology.alias_to_entry.get(key)


def similarity_to_canonical(raw: str, threshold: float = 0.82) -> OntologyEntry | None:
  ontology = get_skill_ontology()
  if not ontology.embeddings:
    return None

  raw_vec = _EMBED_CLIENT.embed([raw])[0]
  best_entry = None
  best_score = 0.0

  for label, vec in ontology.embeddings.items():
    score = cosine_similarity(raw_vec, vec)
    if score > best_score:
      best_score = score
      # prefer display name match
      best_entry = ontology.by_display.get(label) or ontology.alias_to_entry.get(label)

  if best_entry and best_score >= threshold:
    return best_entry
  return None


def record_unknown_skill(raw: str):
  cleaned = (raw or '').strip()
  if not cleaned:
    return
  _UNKNOWN_COUNTS[cleaned] = _UNKNOWN_COUNTS.get(cleaned, 0) + 1
  _, _, unknown_path = _default_paths()
  override = os.getenv('UNKNOWN_SKILLS_PATH')
  if override:
    unknown_path = Path(override)
  _write_unknown_counts(unknown_path)


def list_unknown_skills() -> Dict[str, int]:
  return dict(sorted(_UNKNOWN_COUNTS.items(), key=lambda kv: kv[1], reverse=True))

