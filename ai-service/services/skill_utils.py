from __future__ import annotations

import re
from typing import Dict, List, Set


def normalize_token(token: str) -> str:
  cleaned = re.sub(r'[^a-z0-9+/# ]+', ' ', token.lower())
  cleaned = re.sub(r'\s+', ' ', cleaned).strip()
  return cleaned


_ALIAS_TO_CANON: Dict[str, str] = {
  'python': 'Python',
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'java': 'Java',
  'c++': 'C++',
  'c#': 'C#',
  'go': 'Go',
  'rust': 'Rust',
  'sql': 'SQL',
  'mysql': 'MySQL',
  'mongodb': 'MongoDB',
  'postgres': 'PostgreSQL',
  'postgresql': 'PostgreSQL',
  'aws': 'AWS',
  'amazon web services': 'AWS',
  'gcp': 'GCP',
  'azure': 'Azure',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'terraform': 'Terraform',
  'react': 'React',
  'vue': 'Vue',
  'angular': 'Angular',
  'node.js': 'Node.js',
  'nodejs': 'Node.js',
  'node js': 'Node.js',
  'express': 'Express',
  'expressjs': 'Express',
  'express.js': 'Express',
  'fastapi': 'FastAPI',
  'fast api': 'FastAPI',
  'django': 'Django',
  'flask': 'Flask',
  'graphql': 'GraphQL',
  'rest': 'REST',
  'rest api': 'REST',
  'rest apis': 'REST',
  'microservices': 'Microservices',
  'machine learning': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'nlp': 'NLP',
  'pandas': 'Pandas',
  'numpy': 'NumPy',
  'scikit-learn': 'scikit-learn',
  'pytest': 'pytest',
  'cicd': 'CI/CD',
  'ci/cd': 'CI/CD',
  'ci cd': 'CI/CD',
  'ci': 'CI/CD',
  'git': 'Git',
  'linux': 'Linux',
  'agile': 'Agile',
  'scrum': 'Scrum',
  'kanban': 'Kanban',
  'communication': 'Communication',
  'leadership': 'Leadership',
  'problem solving': 'Problem Solving',
  'project management': 'Project Management',
  'sql server': 'SQL Server',
  'redis': 'Redis',
  'elasticsearch': 'Elasticsearch',
  'snowflake': 'Snowflake',
  'spark': 'Spark',
  'hadoop': 'Hadoop',
  'tableau': 'Tableau',
  'power bi': 'Power BI',
  'rbac': 'RBAC',
  'role based access control': 'RBAC',
  'role-based access control': 'RBAC',
  'jwt': 'JWT',
  'json web token': 'JWT',
  'json-web-token': 'JWT',
  'mongoose': 'Mongoose',
  'mongooselib': 'Mongoose',
  'validation': 'Validation',
  'input validation': 'Validation'
}


def _canonicalize(raw: str) -> str | None:
  normalized = normalize_token(raw)
  if not normalized:
    return None
  if normalized in _ALIAS_TO_CANON:
    return _ALIAS_TO_CANON[normalized]
  return raw.strip()


_CANON_TO_ALIASES: Dict[str, Set[str]] = {}
for alias, canon in _ALIAS_TO_CANON.items():
  _CANON_TO_ALIASES.setdefault(canon, set()).add(alias)


def extract_skills(text: str, max_results: int | None = None) -> List[str]:
  """Return canonicalized skills found within free-form text."""

  normalized_text = normalize_token(text)
  detected_aliases = {alias for alias in _ALIAS_TO_CANON if alias in normalized_text}

  # Capture shorter tokens in bulleted lists (e.g., "• AWS" or "- Kubernetes")
  keyword_matches = re.findall(r'\b[A-Za-z0-9+#./ ]{3,}\b', normalized_text)
  for token in keyword_matches:
    token_norm = normalize_token(token)
    if token_norm in _ALIAS_TO_CANON:
      detected_aliases.add(token_norm)

  ordered = sorted({_ALIAS_TO_CANON[alias] for alias in detected_aliases})

  if max_results is not None:
    return ordered[:max_results]
  return ordered


def normalize_skill_list(skills: List[str]) -> List[str]:
  """Deduplicate and consistently format arbitrary skill strings (alias aware)."""

  normalized: List[str] = []
  seen = set()

  for skill in skills:
    canonical = _canonicalize(skill)
    if not canonical:
      continue
    key = canonical.lower()
    if key in seen:
      continue
    seen.add(key)
    normalized.append(canonical)

  return normalized


def aliases_for(canon: str) -> List[str]:
  return sorted(_CANON_TO_ALIASES.get(canon, set()))

