from typing import List

from pydantic import BaseModel, Field


class JobListing(BaseModel):
  job_id: str
  title: str
  score: float = Field(..., ge=0, le=1)


class RecommendationRequest(BaseModel):
  candidate_id: str | None = None
  skills: List[str] = Field(default_factory=list)
  preferred_locations: List[str] = Field(default_factory=list)


class RecommendationResponse(BaseModel):
  ranked_jobs: List[JobListing]
  generated_at: str

