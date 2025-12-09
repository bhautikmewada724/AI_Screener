from typing import List, Optional

from pydantic import BaseModel, Field


class CandidateProfile(BaseModel):
  """Minimal candidate context sent by the backend."""

  id: Optional[str] = Field(default=None, description='Candidate id for traceability')
  skills: List[str] = Field(default_factory=list)
  preferred_locations: List[str] = Field(default_factory=list)
  embeddings: List[float] = Field(default_factory=list, description='Primary resume embedding')
  location: Optional[str] = None
  summary: Optional[str] = None
  seniority: Optional[str] = None
  job_category: Optional[str] = None


class JobRecommendationInput(BaseModel):
  """Job payload prepared by the backend for recommendation scoring."""

  job_id: str
  title: str
  required_skills: List[str] = Field(default_factory=list)
  nice_to_have_skills: List[str] = Field(default_factory=list)
  embeddings: List[float] = Field(default_factory=list)
  location: Optional[str] = None
  seniority: Optional[str] = None
  job_category: Optional[str] = None


class RecommendedJob(BaseModel):
  job_id: str
  score: float = Field(..., ge=0, le=1)
  rank: int
  reason: str
  title: Optional[str] = None
  location: Optional[str] = None


class RecommendationRequest(BaseModel):
  candidate: CandidateProfile
  jobs: List[JobRecommendationInput] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
  ranked_jobs: List[RecommendedJob]
  generated_at: str
