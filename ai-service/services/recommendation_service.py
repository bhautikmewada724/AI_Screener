from __future__ import annotations

from dataclasses import dataclass
from typing import List

from models.recommendation import JobListing, RecommendationRequest, RecommendationResponse
from utils.mock_data import timestamp


@dataclass(frozen=True)
class CatalogJob:
  job_id: str
  title: str
  skills: List[str]
  location: str


CATALOG: List[CatalogJob] = [
  CatalogJob('job-001', 'Senior Backend Engineer', ['Python', 'FastAPI', 'PostgreSQL', 'AWS'], 'remote'),
  CatalogJob('job-002', 'Machine Learning Engineer', ['Python', 'ML', 'TensorFlow', 'AWS'], 'remote'),
  CatalogJob('job-003', 'Frontend Engineer', ['React', 'TypeScript', 'CSS'], 'new york'),
  CatalogJob('job-004', 'Data Analyst', ['SQL', 'Tableau', 'Python'], 'san francisco'),
  CatalogJob('job-005', 'DevOps Engineer', ['Kubernetes', 'Terraform', 'AWS'], 'remote'),
]


def _normalized(skills: List[str]) -> List[str]:
  return [skill.strip().lower() for skill in skills if skill]


def _score_job(candidate_skills: List[str], preferred_locations: List[str], job: CatalogJob) -> float:
  job_skills = _normalized(job.skills)
  candidate_set = set(candidate_skills)

  overlap = candidate_set.intersection(job_skills)
  skill_score = len(overlap) / (len(job_skills) or 1)

  location_score = 0.2 if not preferred_locations or job.location == 'remote' else 0.0
  if preferred_locations:
    location_score = 1.0 if job.location in preferred_locations else 0.4 if job.location == 'remote' else 0.0

  return 0.8 * skill_score + 0.2 * location_score


def recommend_jobs(payload: RecommendationRequest) -> RecommendationResponse:
  candidate_skills = _normalized(payload.skills)
  preferred_locations = _normalized(payload.preferred_locations)

  scored_jobs = []
  for job in CATALOG:
    job_score = _score_job(candidate_skills, preferred_locations, job)
    if job_score <= 0.1:
      continue
    scored_jobs.append(JobListing(job_id=job.job_id, title=job.title, score=round(job_score, 3)))

  ranked = sorted(scored_jobs, key=lambda listing: listing.score, reverse=True)[:5]

  return RecommendationResponse(ranked_jobs=ranked, generated_at=timestamp())

