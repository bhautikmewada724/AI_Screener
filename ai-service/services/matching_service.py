from __future__ import annotations

import re
from typing import List, Optional, Tuple

from core import get_embeddings_client
from core.embeddings_client import cosine_similarity
from models.match import MatchRequest, MatchResponse

SKILL_WEIGHT = 0.4
EMBEDDING_WEIGHT = 0.3
EXPERIENCE_WEIGHT = 0.2
LOCATION_WEIGHT = 0.1


def _normalize(skills: List[str]) -> List[str]:
  return sorted({skill.strip() for skill in skills if skill})


def _skill_overlap(resume_skills: List[str], job_skills: List[str]) -> tuple[float, List[str], List[str]]:
  resume_set = {skill.lower() for skill in resume_skills}
  job_set = {skill.lower() for skill in job_skills}

  matched = [skill for skill in job_skills if skill.lower() in resume_set]
  missing = [skill for skill in job_skills if skill.lower() not in resume_set]

  coverage = len(matched) / (len(job_skills) or 1)
  return coverage, matched, missing


def _embedding_similarity(payload: MatchRequest) -> float:
  resume_text = payload.resume_summary or ' '.join(payload.resume_skills)
  job_text = payload.job_summary or ' '.join(payload.job_required_skills)

  resume_text = (resume_text or '').strip()
  job_text = (job_text or '').strip()

  if not resume_text or not job_text:
    return 0.0

  embeddings_client = get_embeddings_client()
  vectors = embeddings_client.embed([resume_text, job_text])
  if len(vectors) != 2:
    return 0.0

  similarity = cosine_similarity(vectors[0], vectors[1])
  return _clamp01((similarity + 1) / 2)  # map [-1,1] -> [0,1]


def _experience_alignment(payload: MatchRequest) -> Tuple[float, Optional[float]]:
  resume_years = _extract_years_of_experience(payload.resume_summary)
  job_years = _extract_years_of_experience(payload.job_summary)

  if resume_years is None and job_years is None:
    return 0.5, None
  if resume_years is None:
    return 0.4, None
  if job_years is None:
    return _clamp01(resume_years / 10), resume_years

  ratio = resume_years / job_years if job_years else 1
  return _clamp01(min(ratio, 1.2)), resume_years


def _location_alignment(payload: MatchRequest) -> Tuple[float, str]:
  resume_location = _extract_location(payload.resume_summary)
  job_location = _extract_location(payload.job_summary)

  if not resume_location and not job_location:
    return 0.5, 'unknown'

  if not job_location or not resume_location:
    return 0.6, resume_location or job_location or 'unknown'

  if resume_location == job_location or job_location == 'remote':
    return 1.0, 'match'

  return 0.2, f'{resume_location} vs {job_location}'


def _extract_years_of_experience(text: str | None) -> Optional[float]:
  if not text:
    return None
  match = re.search(r'(\d+(?:\.\d+)?)\s*\+?\s*(?:years|yrs)', text.lower())
  if match:
    try:
      return float(match.group(1))
    except ValueError:
      return None
  return None


def _extract_location(text: str | None) -> Optional[str]:
  if not text:
    return None
  lower = text.lower()
  if 'remote' in lower:
    return 'remote'
  location_hint = re.search(r'location[:\-]?\s*([A-Za-z ,]+)', text, re.IGNORECASE)
  if location_hint:
    return location_hint.group(1).strip().lower()
  return None


def _clamp01(value: float) -> float:
  return max(0.0, min(1.0, value))


def score_match(payload: MatchRequest) -> MatchResponse:
  resume_skills = _normalize(payload.resume_skills)
  job_skills = _normalize(payload.job_required_skills)

  skill_score, matched_skills, missing_skills = _skill_overlap(resume_skills, job_skills)
  embedding_score = _embedding_similarity(payload)
  experience_score, experience_years = _experience_alignment(payload)
  location_score, location_match = _location_alignment(payload)

  match_score = (
    SKILL_WEIGHT * skill_score
    + EMBEDDING_WEIGHT * embedding_score
    + EXPERIENCE_WEIGHT * experience_score
    + LOCATION_WEIGHT * location_score
  )
  match_score = _clamp01(match_score)

  missing_text = (
    f"Missing: {', '.join(missing_skills)}."
    if missing_skills
    else 'All critical skills present.'
  )

  notes = (
    f"{len(matched_skills)} of {len(job_skills) or 1} critical skills matched. "
    f"Embedding similarity {embedding_score:.2f}. "
    f"Experience score {experience_score:.2f}; location score {location_score:.2f}. "
    f"{missing_text}"
  )

  explanation = {
    'components': {
      'skills': {'score': round(skill_score, 3), 'matched': matched_skills, 'missing': missing_skills},
      'embeddings': {'score': round(embedding_score, 3)},
      'experience': {'score': round(experience_score, 3), 'years': experience_years},
      'location': {'score': round(location_score, 3), 'match': location_match}
    },
    'weights': {
      'skills': SKILL_WEIGHT,
      'embeddings': EMBEDDING_WEIGHT,
      'experience': EXPERIENCE_WEIGHT,
      'location': LOCATION_WEIGHT
    },
    'missingSkills': missing_skills,
    'notes': notes
  }

  return MatchResponse(
    match_score=round(match_score, 3),
    matched_skills=matched_skills,
    missing_critical_skills=missing_skills,
    embedding_similarity=round(embedding_score, 3),
    notes=notes,
    explanation=explanation
  )

