from __future__ import annotations

import logging
import re
from typing import List, Optional, Tuple

from fastapi import HTTPException, status
import utils.embeddings_client as embeddings_client
from utils.embeddings_client import cosine_similarity
from models.match import MatchRequest, MatchResponse

logger = logging.getLogger(__name__)

DEFAULT_WEIGHTS = {
  'skills': 45.0,
  'experience': 25.0,
  'education': 20.0,
  'keywords': 10.0
}


def _resolve_weights(scoring_config: dict | None) -> tuple[dict, float]:
  """
  Convert provided weights (0-100) into normalized fractions.
  Falls back to defaults when invalid or missing.
  """
  if not scoring_config:
    weights = DEFAULT_WEIGHTS.copy()
    total = sum(weights.values())
    return weights, total

  raw_weights = scoring_config.get('weights') or {}
  def _safe(key: str, default: float) -> float:
    try:
      value = float(raw_weights.get(key, default))
      if value < 0 or value > 100:
        return default
      return value
    except Exception:
      return default

  weights = {
    'skills': _safe('skills', DEFAULT_WEIGHTS['skills']),
    'experience': _safe('experience', DEFAULT_WEIGHTS['experience']),
    'education': _safe('education', DEFAULT_WEIGHTS['education']),
    'keywords': _safe('keywords', DEFAULT_WEIGHTS['keywords'])
  }

  total = sum(weights.values()) or 100.0
  if round(total) != 100:
    raise HTTPException(
      status_code=status.HTTP_400_BAD_REQUEST,
      detail={'error': 'invalid_scoring_weights', 'message': 'Weights must sum to 100.'}
    )
  return weights, total


def _resolve_constraints(scoring_config: dict | None) -> tuple[list[str], list[str], float | None]:
  if not scoring_config:
    return [], [], None
  constraints = scoring_config.get('constraints') or {}
  must_have = [s for s in constraints.get('mustHaveSkills', []) if s]
  nice_to_have = [s for s in constraints.get('niceToHaveSkills', []) if s]
  min_years = constraints.get('minYearsExperience')
  try:
    min_years_val = float(min_years) if min_years is not None else None
  except Exception:
    min_years_val = None
  return must_have, nice_to_have, min_years_val


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

  client = embeddings_client.get_embeddings_client()
  try:
    vectors = client.embed([resume_text, job_text])
  except Exception as exc:  # noqa: BLE001
    logger.warning('Embedding similarity failed: %s', exc)
    return 0.0

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

  scoring_config = payload.scoring_config or {}
  scoring_config_version = payload.scoring_config_version

  weights, total_weight = _resolve_weights(scoring_config)
  must_have_skills, nice_to_have_skills, min_years_required = _resolve_constraints(scoring_config)

  missing_must_have = [s for s in must_have_skills if s.lower() not in {x.lower() for x in resume_skills}]
  missing_nice_to_have = [s for s in nice_to_have_skills if s.lower() not in {x.lower() for x in resume_skills}]

  # Education and keywords signals are placeholders because the current payload lacks structured fields;
  # keep deterministic mid values to avoid skew.
  education_score = 0.5
  keywords_score = embedding_score  # reuse semantic similarity as a proxy

  if min_years_required is not None and experience_years is not None and experience_years < min_years_required:
    experience_score = experience_score * 0.5

  base_score = (
    weights['skills'] * skill_score
    + weights['experience'] * experience_score
    + weights['education'] * education_score
    + weights['keywords'] * keywords_score
  ) / total_weight

  match_score = _clamp01(base_score)

  if missing_must_have:
    match_score = _clamp01(match_score * 0.6)

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
      'location': {'score': round(location_score, 3), 'match': location_match},
      'education': {'score': round(education_score, 3)},
      'keywords': {'score': round(keywords_score, 3)}
    },
    'weights': weights,
    'missingSkills': missing_skills,
    'missingMustHaveSkills': missing_must_have,
    'missingNiceToHaveSkills': missing_nice_to_have,
    'notes': notes
  }

  score_breakdown = {
    'skills_score': round(skill_score * 100, 1),
    'embeddings_score': round(embedding_score * 100, 1),
    'experience_score': round(experience_score * 100, 1),
    'location_score': round(location_score * 100, 1),
    'education_score': round(education_score * 100, 1),
    'keywords_score': round(keywords_score * 100, 1),
    'final_score': round(match_score * 100, 1),
    'weights': {k: round(v, 1) for k, v in weights.items()}
  }

  model_metadata = {
    'embedding_provider': 'mock' if payload.scoring_config is None else 'mock',
    'llm_provider': 'none',
    'model_version': 'matching_service_v1'
  }

  return MatchResponse(
    match_score=round(match_score, 3),
    matched_skills=matched_skills,
    missing_critical_skills=missing_skills,
    embedding_similarity=round(embedding_score, 3),
    notes=notes,
    explanation=explanation,
    score_breakdown=score_breakdown,
    scoring_config_version=scoring_config_version,
    model_metadata=model_metadata,
    missing_must_have_skills=missing_must_have or [],
    missing_nice_to_have_skills=missing_nice_to_have or [],
  )

