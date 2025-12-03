from typing import List, Optional

from pydantic import BaseModel, Field


class JobDescriptionRequest(BaseModel):
  job_title: str = Field(..., description='Human readable job title')
  job_description: str = Field(..., description='Plain text job description')
  location: Optional[str] = Field(None, description='Optional location metadata')


class JobDescriptionResponse(BaseModel):
  required_skills: List[str]
  summary: str
  embeddings: List[float] = Field(default_factory=list)

