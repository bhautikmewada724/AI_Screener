from __future__ import annotations

import os
import re
from typing import Dict, List, Optional, Set, Tuple, overload

from utils.skill_ontology_loader import (
  OntologyEntry,
  get_skill_ontology,
  record_unknown_skill,
  resolve_alias_to_canonical,
  similarity_to_canonical
)

# ---------------------------------------------------------------------------
# Multi-word skill phrases (case-insensitive patterns)
# These are detected before tokenization so hyphenated and spaced phrases
# are not broken apart.
# ---------------------------------------------------------------------------
_MULTI_WORD_SKILLS: Tuple[str, ...] = (
  'machine learning',
  'deep learning',
  'data analysis',
  'data analytics',
  'data science',
  'data engineering',
  'data visualization',
  'data pipelines',
  'natural language processing',
  'computer vision',
  'artificial intelligence',
  'generative ai',
  'large language model',
  'large language models',
  'web development',
  'mobile development',
  'full stack',
  'front end',
  'back end',
  'system design',
  'software architecture',
  'microservice architecture',
  'micro services',
  'test driven development',
  'continuous integration',
  'continuous deployment',
  'continuous delivery',
  'version control',
  'object oriented programming',
  'functional programming',
  'design patterns',
  'agile methodology',
  'unit testing',
  'react native',
  'ruby on rails',
  'node js',
  'express js',
  'vue js',
  'angular js',
  'next js',
  'spring boot',
  'google cloud',
  'google cloud platform',
  'amazon web services',
  'microsoft azure',
  'power bi',
  'apache spark',
  'apache kafka',
  'apache airflow',
  'apache cassandra',
  'json web token',
  'json web tokens',
  'rest api',
  'rest apis',
  'restful api',
  'restful apis',
  'graph ql',
  'tailwind css',
  'material ui',
  'material design',
  'github actions',
  'gitlab ci',
  'aws lambda',
  'aws s3',
  'aws ec2',
  'oracle db',
  'oracle database',
  'rabbit mq',
  'scikit learn',
  'scikit-learn',
  'hugging face',
  'sql alchemy',
  'hf transformers',
  'open cv',
  'socket.io',
)

# Compile patterns once at module-load time
_MW_PATTERNS = [
  (re.compile(r'\b' + re.escape(phrase) + r'\b', re.IGNORECASE), phrase)
  for phrase in sorted(_MULTI_WORD_SKILLS, key=len, reverse=True)
]

# Irrelevant tokens to filter out -- common resume filler words that should
# not be treated as skills.
_NOISE_TOKENS: Set[str] = {
  'and', 'the', 'for', 'with', 'using', 'used', 'including',
  'such', 'like', 'also', 'able', 'work', 'working', 'worked',
  'experience', 'experienced', 'knowledge', 'proficient', 'familiar',
  'strong', 'excellent', 'good', 'understanding', 'hands-on',
  'professional', 'team', 'project', 'projects', 'years', 'year',
  'development', 'developed', 'developing', 'building', 'built',
  'based', 'various', 'multiple', 'several', 'tools', 'technologies',
  'skills', 'technical', 'currently', 'responsible', 'involved',
  'implemented', 'implementation', 'utilized', 'utilized',
  'etc', 'e.g', 'i.e', 'others', 'more', 'other', 'related',
  'time', 'level', 'role', 'position', 'company', 'organization',
  'name', 'email', 'phone', 'address', 'education', 'university',
  'college', 'institute', 'school', 'bachelor', 'master', 'degree',
  'certification', 'certified', 'summary', 'objective', 'profile',
  'contact', 'details', 'information', 'resume', 'curriculum',
  'vitae', 'india', 'usa', 'remote', 'location', 'present',
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
  'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep',
  'oct', 'nov', 'dec'
}


def normalize_token(token: str) -> str:
  """Normalize a skill token: lowercase, strip noise, unify synonyms."""
  cleaned = re.sub(r'[^a-z0-9+/# .\-]+', ' ', token.lower())
  # Specific synonym normalizations
  cleaned = cleaned.replace('node.js', 'nodejs').replace('node js', 'nodejs')
  cleaned = cleaned.replace('react.js', 'react').replace('react js', 'react')
  cleaned = cleaned.replace('vue.js', 'vue').replace('vue js', 'vue')
  cleaned = cleaned.replace('express.js', 'express').replace('express js', 'express')
  cleaned = cleaned.replace('next.js', 'nextjs').replace('next js', 'nextjs')
  cleaned = re.sub(r'\brest\s+apis?\b', 'rest api', cleaned)
  cleaned = re.sub(r'\brestful\s+apis?\b', 'rest api', cleaned)
  cleaned = re.sub(r'\s+', ' ', cleaned).strip()
  return cleaned


def _dedupe_preserve(items: List[str]) -> List[str]:
  """Remove duplicates while preserving insertion order."""
  seen: Set[str] = set()
  out: List[str] = []
  for item in items:
    key = item.lower().strip()
    if key in seen or not key:
      continue
    seen.add(key)
    out.append(item)
  return out


def _is_noise(token: str) -> bool:
  """Return True if the token is a noise/filler word."""
  return token.lower().strip() in _NOISE_TOKENS or len(token.strip()) < 2


def _match_alias_or_ontology(raw: str) -> Tuple[Optional[str], Optional[OntologyEntry]]:
  """Attempt to resolve a raw skill string against the ontology."""
  ontology = get_skill_ontology()
  alias_match = resolve_alias_to_canonical(raw)
  if alias_match:
    return alias_match.displayName, alias_match

  threshold = float(os.getenv('SKILL_EMBED_THRESHOLD', '0.82'))
  sim_match = similarity_to_canonical(raw, threshold=threshold)
  if sim_match:
    return sim_match.displayName, sim_match
  return None, None


def _extract_multiword_skills(text: str) -> Tuple[List[str], str]:
  """Extract multi-word skill phrases and return them + the remaining text
  with those phrases removed (to avoid re-tokenizing parts of them)."""
  found: List[str] = []
  remaining = text

  for pattern, phrase in _MW_PATTERNS:
    matches = list(pattern.finditer(remaining))
    if matches:
      found.append(phrase)
      # Remove matched spans from remaining text
      for match in reversed(matches):
        remaining = remaining[:match.start()] + ' ' + remaining[match.end():]

  return found, remaining


@overload
def extract_skills(text: str, max_results: int | None = ..., *, return_unverified: bool = ...) -> Tuple[List[str], List[str]]: ...
@overload
def extract_skills(text: str, max_results: int | None = ...) -> List[str]: ...

def extract_skills(text: str, max_results: int | None = None, *, return_unverified: bool = False):
  """Return canonicalized skills found within free-form text.

  When return_unverified=True, returns a (verified, unverified) tuple.
  Otherwise returns just the verified list for backward compatibility.
  """
  if not text or not text.strip():
    return ([], []) if return_unverified else []

  # Step 1: detect multi-word skills first
  multiword_found, remaining_text = _extract_multiword_skills(text)

  # Step 2: normalize remaining text and extract single-word tokens
  normalized_text = normalize_token(remaining_text)
  tokens = re.findall(r'[a-z0-9+/#.\-]{2,}', normalized_text)

  candidates: List[str] = []

  # Add multi-word skills first (higher priority)
  for phrase in multiword_found:
    candidates.append(normalize_token(phrase))

  # Add single-word tokens
  for token in tokens:
    token = token.strip('.- ')
    if not token or _is_noise(token):
      continue
    candidates.append(token)

  # Also capture comma/newline/semicolon separated phrases
  for part in re.split(r'[,\n;|]+', normalized_text):
    part = part.strip()
    if part and not _is_noise(part) and len(part) >= 2:
      candidates.append(part)

  verified: List[str] = []
  unverified: List[str] = []

  for cand in candidates:
    canonical, entry = _match_alias_or_ontology(cand)
    if canonical:
      verified.append(canonical)
    else:
      # Only add as unverified if it's not noise and has reasonable length
      cleaned = cand.strip()
      if cleaned and not _is_noise(cleaned) and len(cleaned) >= 2:
        unverified.append(cleaned)
        record_unknown_skill(cleaned)

  verified = _dedupe_preserve(verified)
  unverified = _dedupe_preserve(unverified)

  # Remove any unverified that are substrings of verified
  verified_lower = {v.lower() for v in verified}
  unverified = [u for u in unverified if u.lower() not in verified_lower]

  if max_results is not None:
    verified = verified[:max_results]

  if return_unverified:
    return verified, unverified
  return verified


@overload
def normalize_skill_list(skills: List[str], *, return_unverified: bool = ...) -> Tuple[List[str], List[str]]: ...
@overload
def normalize_skill_list(skills: List[str]) -> List[str]: ...

def normalize_skill_list(skills: List[str], *, return_unverified: bool = False):
  """Deduplicate and consistently format arbitrary skill strings.

  When return_unverified=True, returns (normalized, unverified) tuple.
  Otherwise returns just the normalized list for backward compatibility.
  """
  normalized: List[str] = []
  unverified: List[str] = []
  seen: Set[str] = set()

  for skill in skills:
    if not skill or not skill.strip():
      continue
    canonical, entry = _match_alias_or_ontology(skill)
    target = canonical or skill.strip()
    key = target.lower()
    if not key or key in seen:
      continue
    seen.add(key)
    normalized.append(target)
    if not entry:
      if not _is_noise(target):
        unverified.append(target)
        record_unknown_skill(target)

  if return_unverified:
    return normalized, unverified
  return normalized


def categorize_skills(skills: List[str]) -> Dict[str, List[str]]:
  """Group skills by their ontology category."""
  categories: Dict[str, List[str]] = {}
  for skill in skills:
    canonical, entry = _match_alias_or_ontology(skill)
    category = entry.category if entry else 'other'
    display = canonical or skill
    categories.setdefault(category, []).append(display)
  return categories


def aliases_for(canon: str) -> List[str]:
  """Return all known aliases for a canonical skill name."""
  ontology = get_skill_ontology()
  entry = ontology.by_display.get(canon) or ontology.by_id.get(canon)
  if not entry:
    return []
  return sorted(set(entry.aliases or []))
