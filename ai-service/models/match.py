from typing import List

from pydantic import BaseModel, Field


class MatchRequest(BaseModel):
  resume_skills: List[str] = Field(default_factory=list, description='Skills extracted from resume parsing')
  job_required_skills: List[str] = Field(default_factory=list, description='Skills extracted from the job description')
  resume_summary: str | None = Field(None, description='Optional resume summary for context')
  job_summary: str | None = Field(None, description='Optional job description summary')
  scoring_config: dict | None = Field(
    default=None,
    description='Optional scoring configuration provided by the gateway (weights/constraints).'
  )
  scoring_config_version: int | None = Field(
    default=None,
    description='Version of the scoring config used by the gateway.'
  )


class MatchResponse(BaseModel):
  match_score: float = Field(..., ge=0, le=1)
  matched_skills: List[str]
  notes: str = Field(..., description='Human friendly explanation of the match output')
  missing_critical_skills: List[str] = Field(default_factory=list)
  embedding_similarity: float = Field(default=0.0, ge=0, le=1)
  explanation: dict | None = Field(
    default=None,
    description='Structured explanation (weights, details, heuristics).'
  )
  score_breakdown: dict | None = Field(
    default=None,
    description='Component-level scores (0-100) and final score (0-100).'
  )
  scoring_config_version: int | None = Field(
    default=None,
    description='Version of the scoring config used.'
  )
  model_metadata: dict | None = Field(
    default=None,
    description='Provider/model identifiers for auditability.'
  )
  missing_must_have_skills: List[str] | None = Field(default=None)
  missing_nice_to_have_skills: List[str] | None = Field(default=None)

