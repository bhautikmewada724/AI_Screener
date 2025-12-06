from typing import List, Optional

from pydantic import BaseModel, Field


class ExperienceItem(BaseModel):
  company: str = Field(..., description='Company or organization name')
  role: str = Field(..., description='Role or title held')
  duration: Optional[str] = Field(None, description='Human readable duration, e.g. Jan 2020 - Mar 2022')
  startDate: Optional[str] = Field(None, description='ISO8601 start date if parsed')
  endDate: Optional[str] = Field(None, description='ISO8601 end date if parsed')


class EducationItem(BaseModel):
  institution: str = Field(..., description='University or school name')
  degree: Optional[str] = Field(None, description='Degree or certification obtained')
  graduation_year: Optional[int] = Field(None, description='Year of graduation if known')


class ResumeParseRequest(BaseModel):
  file_path: str = Field(..., description='Backend-accessible file path for the uploaded resume')
  file_name: str = Field(..., description='Original file name')
  user_id: str = Field(..., description='Candidate identifier')
  resume_text: Optional[str] = Field(None, description='Optional raw text fallback')
  candidate_name: Optional[str] = Field(None, description='Optional candidate name metadata')


class ResumeParseResponse(BaseModel):
  summary: str
  skills: List[str]
  experience: List[ExperienceItem]
  education: List[EducationItem]
  location: Optional[str] = Field(None, description='Detected location or remote status')
  embeddings: List[float] = Field(default_factory=list, description='Embedding vector for downstream tasks')
  warnings: List[str] = Field(default_factory=list, description='Non-fatal issues encountered during parsing')

