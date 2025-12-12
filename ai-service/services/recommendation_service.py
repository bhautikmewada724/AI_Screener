from __future__ import annotations

from typing import List, Optional, Tuple

from utils.embeddings_client import cosine_similarity
from models.recommendation import (
  CandidateProfile,
  JobRecommendationInput,
  RecommendationRequest,
  RecommendationResponse,
  RecommendedJob,
)
from utils.mock_data import timestamp

SKILL_WEIGHT = 0.45
NICE_TO_HAVE_WEIGHT = 0.1
EMBEDDING_WEIGHT = 0.35
LOCATION_WEIGHT = 0.05
SENIORITY_WEIGHT = 0.05
MIN_SCORE_THRESHOLD = 0.1


def _normalized(skills: List[str]) -> List[str]:
  return [skill.strip().lower() for skill in skills if skill]


def _skill_overlap(candidate_skills: List[str], job_skills: List[str]) -> Tuple[float, List[str]]:
  candidate_set = set(_normalized(candidate_skills))
  job_set = _normalized(job_skills)

  overlap = [skill for skill in job_set if skill in candidate_set]
  coverage = len(overlap) / (len(job_set) or 1)
  return coverage, overlap


def _nice_to_have_overlap(candidate_skills: List[str], nice_skills: List[str]) -> Tuple[float, List[str]]:
  if not nice_skills:
    return 0.0, []

  candidate_set = set(_normalized(candidate_skills))
  nice_set = _normalized(nice_skills)

  overlap = [skill for skill in nice_set if skill in candidate_set]
  coverage = len(overlap) / (len(nice_set) or 1)
  return coverage, overlap


def _embedding_similarity(candidate: CandidateProfile, job: JobRecommendationInput) -> float:
  if not candidate.embeddings or not job.embeddings:
    return 0.0
  return _clamp01((cosine_similarity(candidate.embeddings, job.embeddings) + 1) / 2)


def _location_alignment(candidate: CandidateProfile, job: JobRecommendationInput) -> float:
  preferred = {_normalize_location(loc) for loc in candidate.preferred_locations if loc}
  job_loc = _normalize_location(job.location)

  if not preferred:
    return 0.6 if job_loc == 'remote' else 0.4

  if job_loc in preferred:
    return 1.0
  if job_loc == 'remote':
    return 0.7
  return 0.2


def _seniority_alignment(candidate: CandidateProfile, job: JobRecommendationInput) -> float:
  if not candidate.seniority or not job.seniority:
    return 0.5
  return 1.0 if candidate.seniority.lower() == job.seniority.lower() else 0.3


def _normalize_location(value: Optional[str]) -> Optional[str]:
  return value.strip().lower() if value else None


def _clamp01(value: float) -> float:
  return max(0.0, min(1.0, value))


def _reason(overlap: List[str], embedding_score: float, job: JobRecommendationInput) -> str:
  parts = []
  if overlap:
    parts.append(f"Skill overlap: {', '.join(overlap[:3])}")
  if embedding_score >= 0.75:
    parts.append('High semantic similarity to your resume')
  elif embedding_score >= 0.5:
    parts.append('Moderate semantic similarity')
  if job.location:
    parts.append(f"Location: {job.location}")
  return '; '.join(parts) or 'Recommended based on your skills and profile'


def _score_job(candidate: CandidateProfile, job: JobRecommendationInput) -> Tuple[float, List[str], float, float, float]:
  skill_score, overlap = _skill_overlap(candidate.skills, job.required_skills)
  nice_score, nice_overlap = _nice_to_have_overlap(candidate.skills, job.nice_to_have_skills)
  embedding_score = _embedding_similarity(candidate, job)
  location_score = _location_alignment(candidate, job)
  seniority_score = _seniority_alignment(candidate, job)

  total = (
    SKILL_WEIGHT * skill_score
    + NICE_TO_HAVE_WEIGHT * nice_score
    + EMBEDDING_WEIGHT * embedding_score
    + LOCATION_WEIGHT * location_score
    + SENIORITY_WEIGHT * seniority_score
  )
  combined_overlap = overlap or nice_overlap
  return _clamp01(total), combined_overlap, embedding_score, location_score, seniority_score


def recommend_jobs(payload: RecommendationRequest) -> RecommendationResponse:
  candidate = payload.candidate
  ranked: List[RecommendedJob] = []

  for job in payload.jobs:
    score, overlap, embedding_score, _, _ = _score_job(candidate, job)
    if score < MIN_SCORE_THRESHOLD:
      continue

    ranked.append(
      RecommendedJob(
        job_id=job.job_id,
        title=job.title,
        location=job.location,
        score=round(score, 3),
        rank=0,  # temporary, assigned after sorting
        reason=_reason(overlap, embedding_score, job),
      )
    )

  ranked = sorted(ranked, key=lambda item: item.score, reverse=True)
  for idx, job in enumerate(ranked, start=1):
    job.rank = idx

  return RecommendationResponse(ranked_jobs=ranked, generated_at=timestamp())
