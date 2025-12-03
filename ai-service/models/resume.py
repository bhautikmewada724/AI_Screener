from typing import List, Optional

from pydantic import BaseModel, Field


class ExperienceItem(BaseModel):
  company: str = Field(..., description='Company or organization name')
  role: str = Field(..., description='Role or title held')
  duration: Optional[str] = Field(None, description='Human readable duration, e.g. Jan 2020 - Mar 2022')


class EducationItem(BaseModel):
  institution: str = Field(..., description='University or school name')
  degree: Optional[str] = Field(None, description='Degree or certification obtained')
  graduation_year: Optional[int] = Field(None, description='Year of graduation if known')


class ResumeParseRequest(BaseModel):
  resume_text: str = Field(..., description='Plain text extracted from candidate resume')
  candidate_name: Optional[str] = Field(None, description='Optional candidate name metadata')


class ResumeParseResponse(BaseModel):
  summary: str
  skills: List[str]
  experience: List[ExperienceItem]
  education: List[EducationItem]
  embeddings: List[float] = Field(default_factory=list, description='Mocked embedding vector for downstream tasks')

