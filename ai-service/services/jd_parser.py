from __future__ import annotations

import re
from typing import Dict, List, Optional

from core import get_embeddings_client, get_llm_client
from models.job import JobDescriptionRequest, JobDescriptionResponse
from utils.settings import get_settings

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
  'mongodb': 'MongoDB',
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
  'graphql': 'GraphQL',
  'rest': 'REST',
  'machine learning': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'nlp': 'NLP',
  'pandas': 'Pandas',
  'numpy': 'NumPy',
  'spark': 'Spark',
  'hadoop': 'Hadoop',
  'docker': 'Docker',
  'kafka': 'Kafka',
  'redis': 'Redis',
  'elasticsearch': 'Elasticsearch',
  'git': 'Git',
  'linux': 'Linux',
  'ci/cd': 'CI/CD'
}

_PREFERRED_HINTS = ('preferred', 'nice to have', 'bonus', 'plus', 'optional')

_SENIORITY_KEYWORDS = {
  'intern': 'intern',
  'entry': 'junior',
  'junior': 'junior',
  'mid': 'mid',
  'intermediate': 'mid',
  'senior': 'senior',
  'sr': 'senior',
  'lead': 'senior',
  'principal': 'senior',
  'staff': 'senior',
  'director': 'senior'
}

_CATEGORY_KEYWORDS = {
  'backend': ['backend', 'api', 'microservice', 'database', 'server-side'],
  'frontend': ['frontend', 'ui', 'react', 'vue', 'angular', 'css', 'typescript'],
  'data': ['data scientist', 'data engineer', 'analytics', 'etl', 'ml', 'machine learning'],
  'devops': ['devops', 'sre', 'infrastructure', 'kubernetes', 'terraform', 'ci/cd', 'observability'],
  'product': ['product manager', 'roadmap', 'stakeholder', 'prioritize', 'product strategy'],
  'design': ['designer', 'ux', 'ui/ux', 'figma', 'prototyping']
}


class JobDescriptionParser:
  """Parse raw job descriptions into structured insights."""

  def __init__(self) -> None:
    self._settings = get_settings()
    self._llm_client = get_llm_client()
    self._embeddings_client = get_embeddings_client()
    self._use_llm = self._settings.ai_provider.lower() != 'mock'

  def parse(self, payload: JobDescriptionRequest) -> JobDescriptionResponse:
    warnings: List[str] = []
    text = (payload.job_description or '').strip()
    if not text:
      warnings.append('Job description text was empty.')

    summary = self._generate_summary(payload.job_title, text, payload.location)
    required_skills = self._extract_skills(text)
    nice_to_have_skills, preferred_set = self._extract_preferred_skills(text)
    required_skills = [skill for skill in required_skills if skill not in preferred_set]
    seniority_level = self._detect_seniority(payload.job_title, text)
    job_category = self._detect_category(payload.job_title, text)
    embeddings = self._build_embeddings(payload.job_title, text, summary)

    return JobDescriptionResponse(
      required_skills=required_skills,
      summary=summary,
      embeddings=embeddings,
      nice_to_have_skills=nice_to_have_skills,
      seniority_level=seniority_level,
      job_category=job_category,
      warnings=warnings
    )

  def _generate_summary(self, job_title: str, description: str, location: Optional[str]) -> str:
    if not self._use_llm:
      base = description.splitlines()
      snippet = ' '.join(base[:4])
      return f"{job_title} role based in {location or 'any location'}. {snippet[:200]}".strip()

    prompt = (
      "Summarize the following job description in 3 concise sentences covering mission, "
      "key responsibilities, and required experience. Respond with prose (no bullets).\n"
      f"Job title: {job_title}\n"
      f"Location: {location or 'unspecified'}\n"
      f"Description:\n{description[:4000]}"
    )
    try:
      return self._llm_client.run(prompt)
    except Exception as exc:  # noqa: BLE001
      return f'{job_title} opportunity summary unavailable (LLM failed: {exc}).'

  def _extract_skills(self, text: str) -> List[str]:
    normalized_lines = [line.lower() for line in text.splitlines()]
    detected_map: Dict[str, int] = {}

    for line_index, line in enumerate(normalized_lines):
      for key, canonical in _SKILL_LIBRARY.items():
        if key in line and canonical not in detected_map:
          detected_map[canonical] = line_index

    sorted_entries = sorted(detected_map.items(), key=lambda kv: kv[1])
    return [canonical for canonical, _ in sorted_entries]

  def _extract_preferred_skills(self, text: str) -> tuple[List[str], set[str]]:
    preferred: Dict[str, int] = {}
    lines = text.splitlines()
    for idx, line in enumerate(lines):
      lower = line.lower()
      if any(hint in lower for hint in _PREFERRED_HINTS):
        block = lower
        if idx + 1 < len(lines):
          block += ' ' + lines[idx + 1].lower()
        for key, canonical in _SKILL_LIBRARY.items():
          if key in block and canonical not in preferred:
            preferred[canonical] = idx
    sorted_preferred = sorted(preferred.items(), key=lambda kv: kv[1])
    preferred_list = [canonical for canonical, _ in sorted_preferred]
    return preferred_list, set(preferred_list)

  def _detect_seniority(self, job_title: str, description: str) -> Optional[str]:
    job_lower = job_title.lower()
    for keyword, level in _SENIORITY_KEYWORDS.items():
      if keyword in job_lower:
        return level

    text = f'{job_lower} {description.lower()}'
    for keyword, level in _SENIORITY_KEYWORDS.items():
      if keyword in text:
        return level
    return None

  def _detect_category(self, job_title: str, description: str) -> Optional[str]:
    text = f'{job_title.lower()} {description.lower()}'
    best_category = None
    max_hits = 0
    for category, keywords in _CATEGORY_KEYWORDS.items():
      hits = sum(1 for keyword in keywords if keyword in text)
      if hits > max_hits:
        max_hits = hits
        best_category = category
    return best_category

  def _build_embeddings(self, job_title: str, description: str, summary: str) -> List[float]:
    combined = f'{job_title}\n{summary}\n{description[:4000]}'
    try:
      vectors = self._embeddings_client.embed([combined])
      return vectors[0] if vectors else []
    except Exception:  # noqa: BLE001
      return []


def parse_job_description(payload: JobDescriptionRequest) -> JobDescriptionResponse:
  parser = JobDescriptionParser()
  return parser.parse(payload)


