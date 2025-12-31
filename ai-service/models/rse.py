from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


RequirementType = Literal['skill', 'tool', 'domain', 'experience', 'location', 'education']
RequirementStatus = Literal['STRONG', 'WEAK', 'UNCERTAIN', 'MISSING']


class JDRequirement(BaseModel):
  """Canonical representation of an explicit JD requirement."""

  id: str = Field(..., description='Stable identifier derived from the normalized terms')
  type: RequirementType
  rawText: str = Field(..., description='Exact JD phrase that introduced the requirement')
  normalizedTerms: List[str] = Field(default_factory=list, description='Normalized aliases/synonyms')
  weight: float = Field(..., description='Relative importance; required > preferred/constraints')
  isRequired: bool = Field(..., description='True when the JD explicitly marks this as must-have')
  explicitlyStated: bool = Field(True, description='True only when found verbatim in the JD text')
  evidenceRule: Optional[str] = Field(None, description='What counts as proof for this requirement')


class RequirementResult(BaseModel):
  """Evaluation result for a single requirement against a resume."""

  requirementId: str
  requirementText: str
  normalizedTerms: List[str] = Field(default_factory=list)
  status: RequirementStatus
  satisfactionScore: float = Field(..., ge=0, le=1)
  confidence: float = Field(..., ge=0, le=1)
  evidenceSnippets: List[str] = Field(default_factory=list, description='<=120 char excerpts')
  section: Optional[str] = Field(None, description='Resume section where the evidence was found')


class JDScoreBreakdown(BaseModel):
  jdFitScore: float = Field(..., ge=0, le=100)
  requiredScore: float = Field(..., ge=0, le=100)
  preferredScore: float = Field(..., ge=0, le=100)
  evidenceStrengthScore: float = Field(..., ge=0, le=100)
  totalWeight: float = Field(..., ge=0)
  counts: dict = Field(default_factory=dict)

