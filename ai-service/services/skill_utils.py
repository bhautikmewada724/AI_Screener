from __future__ import annotations

import re
from typing import Dict, List

_SKILL_LIBRARY: Dict[str, str] = {
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
  'fastapi': 'FastAPI',
  'django': 'Django',
  'flask': 'Flask',
  'graphql': 'GraphQL',
  'rest': 'REST',
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
  'power bi': 'Power BI'
}


def extract_skills(text: str, max_results: int | None = None) -> List[str]:
  """Return canonicalized skills found within free-form text."""

  normalized_text = text.lower()
  detected_keys = {skill for skill in _SKILL_LIBRARY if skill in normalized_text}

  # Capture shorter tokens in bulleted lists (e.g., "• AWS" or "- Kubernetes")
  keyword_matches = re.findall(r'\b[A-Za-z0-9+#./ ]{3,}\b', normalized_text)
  for token in keyword_matches:
    token = token.strip()
    if token in _SKILL_LIBRARY:
      detected_keys.add(token)

  ordered = sorted({_SKILL_LIBRARY[key] for key in detected_keys})

  if max_results is not None:
    return ordered[:max_results]
  return ordered


def normalize_skill_list(skills: List[str]) -> List[str]:
  """Deduplicate and consistently format arbitrary skill strings."""

  normalized: List[str] = []
  seen = set()

  for skill in skills:
    if not skill:
      continue
    cleaned = re.sub(r'\s+', ' ', skill).strip()
    if not cleaned:
      continue
    key = cleaned.lower()
    if key in seen:
      continue
    seen.add(key)
    normalized.append(cleaned)

  return normalized

