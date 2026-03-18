from __future__ import annotations

import json
import logging
import re
from typing import List, Optional, Tuple

from utils.embeddings_client import get_embeddings_client
from utils.llm_client import get_llm_client
from models.job import JobDescriptionRequest, JobDescriptionResponse
from services.skill_utils import extract_skills, normalize_skill_list
from utils.settings import get_settings

logger = logging.getLogger(__name__)

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
    provider = self._settings.ai_provider.lower().strip()
    self._use_llm = provider != 'mock' and bool(self._settings.openai_api_key)

  def parse(self, payload: JobDescriptionRequest) -> JobDescriptionResponse:
    warnings: List[str] = []
    text = (payload.job_description or '').strip()
    if not text:
      warnings.append('Job description text was empty.')

    structured = None
    if self._use_llm and text:
      try:
        structured = self._extract_structured_with_llm(payload.job_title, payload.location, text)
      except Exception as exc:  # noqa: BLE001
        warnings.append('LLM JD parsing unavailable, falling back to heuristics.')
        logger.warning('LLM JD parsing failed: %s', exc)

    summary = structured.get('summary') if structured else None
    if not summary:
      summary = self._generate_summary(payload.job_title, text, payload.location)

    required_skills = normalize_skill_list(structured.get('required_skills', [])) if structured else []
    if not required_skills:
      required_skills = self._extract_skills(text)

    nice_to_have_skills = normalize_skill_list(structured.get('nice_to_have_skills', [])) if structured else []
    if not nice_to_have_skills:
      nice_to_have_skills = self._extract_preferred_skills(text)[0]

    # Remove overlap so we don't double-count
    preferred_set = {skill.lower() for skill in nice_to_have_skills}
    required_skills = [skill for skill in required_skills if skill.lower() not in preferred_set]

    seniority_level = structured.get('seniority_level') if structured else None
    if not seniority_level:
      seniority_level = self._detect_seniority(payload.job_title, text)

    job_category = structured.get('job_category') if structured else None
    if not job_category:
      job_category = self._detect_category(payload.job_title, text)

    embeddings = self._build_embeddings(payload.job_title, text, summary or '')

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
    return normalize_skill_list(extract_skills(text))

  def _extract_preferred_skills(self, text: str) -> Tuple[List[str], set[str]]:
    preferred = {}
    lines = text.splitlines()
    for idx, line in enumerate(lines):
      lower = line.lower()
      if any(hint in lower for hint in _PREFERRED_HINTS):
        block = lower
        if idx + 1 < len(lines):
          block += ' ' + lines[idx + 1].lower()
        for skill in extract_skills(block):
          if skill not in preferred:
            preferred[skill] = idx

    sorted_preferred = sorted(preferred.items(), key=lambda kv: kv[1])
    preferred_list = [skill for skill, _ in sorted_preferred]
    return preferred_list, {skill.lower() for skill in preferred_list}

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

  def _extract_structured_with_llm(self, title: str, location: Optional[str], description: str) -> dict:
    prompt = (
      "Extract structured details for this job description and respond with JSON containing the keys "
      "`summary` (string), `required_skills` (array of strings), `nice_to_have_skills` (array of strings), "
      "`seniority_level` (string), and `job_category` (string). Normalize skill casing, keep arrays small (<10), "
      "and prefer concise summaries.\n"
      f"Job title: {title}\n"
      f"Location: {location or 'unspecified'}\n"
      f"Description:\n{description[:6000]}"
    )
    raw = self._llm_client.run(prompt, temperature=0.1, system_prompt='You convert job descriptions into JSON.')
    return self._parse_json_response(raw)

  def _parse_json_response(self, content: str) -> dict:
    sanitized = content.strip()
    if '```' in sanitized:
      sanitized = sanitized.split('```', 1)[1]
      sanitized = sanitized.split('```', 1)[0]
    sanitized = sanitized.strip()
    try:
      data = json.loads(sanitized)
    except json.JSONDecodeError:
      logger.warning('JD LLM response was not valid JSON.')
      raise
    if not isinstance(data, dict):
      raise ValueError('JD LLM response must be a JSON object.')
    return data


def parse_job_description(payload: JobDescriptionRequest) -> JobDescriptionResponse:
  parser = JobDescriptionParser()
  return parser.parse(payload)


