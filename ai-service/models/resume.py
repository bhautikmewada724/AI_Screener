from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ExperienceItem(BaseModel):
  company: str = Field(..., description='Company or organization name')
  role: str = Field(..., description='Role or title held')
  duration: Optional[str] = Field(None, description='Human readable duration, e.g. Jan 2020 - Mar 2022')
  startDate: Optional[str] = Field(None, description='ISO8601 start date if parsed')
  endDate: Optional[str] = Field(None, description='ISO8601 end date if parsed')
  description: Optional[str] = Field(None, description='Bullet points or description of responsibilities')
  location: Optional[str] = Field(None, description='Location of the role if detected')


class EducationItem(BaseModel):
  institution: str = Field(..., description='University or school name')
  degree: Optional[str] = Field(None, description='Degree or certification obtained')
  graduation_year: Optional[int] = Field(None, description='Year of graduation if known')

  model_config = ConfigDict(populate_by_name=True)


class SectionMeta(BaseModel):
  line_count: int = Field(..., alias='lineCount', description='Line count observed for the section')
  confidence: Optional[float] = Field(
    None, alias='confidence', description='Optional heuristic confidence for the section split'
  )

  model_config = ConfigDict(populate_by_name=True)


class ResumeParseDebug(BaseModel):
  request_id: Optional[str] = Field(
    default=None, alias='requestId', description='Request identifier used for tracing'
  )
  raw_text: Optional[str] = Field(
    default=None, alias='rawText', description='Truncated raw text excerpt (debug only)'
  )
  raw_sections: Optional[Dict[str, str]] = Field(
    default=None, alias='rawSections', description='Truncated raw section text (debug only)'
  )
  section_meta: Optional[Dict[str, SectionMeta]] = Field(
    default=None, alias='sectionMeta', description='Section metadata such as line counts'
  )
  parser_warnings: List[str] = Field(
    default_factory=list, alias='parserWarnings', description='Warning codes emitted during parsing'
  )
  timings_ms: Dict[str, int] = Field(
    default_factory=dict, alias='timingsMs', description='Timing breakdowns in milliseconds'
  )

  model_config = ConfigDict(populate_by_name=True)


class ResumeParseRequest(BaseModel):
  file_path: str = Field(..., description='Backend-accessible file path for the uploaded resume')
  file_name: str = Field(..., description='Original file name')
  user_id: str = Field(..., description='Candidate identifier')
  resume_text: Optional[str] = Field(None, description='Optional raw text fallback')
  candidate_name: Optional[str] = Field(None, description='Optional candidate name metadata')

  model_config = ConfigDict(populate_by_name=True)


class ResumeParseResponse(BaseModel):
  summary: str
  skills: List[str]
  unverified_skills: List[str] = Field(default_factory=list, description='Skill candidates filtered out by validation')
  experience: List[ExperienceItem]
  education: List[EducationItem]
  location: Optional[str] = Field(None, description='Detected location or remote status')
  embeddings: List[float] = Field(default_factory=list, description='Embedding vector for downstream tasks')
  warnings: List[str] = Field(default_factory=list, description='Non-fatal issues encountered during parsing')
  request_id: Optional[str] = Field(
    default=None, alias='requestId', description='Request identifier used for tracing'
  )
  debug: Optional[ResumeParseDebug] = Field(
    default=None, description='Optional debug payload when explicitly requested'
  )

  model_config = ConfigDict(populate_by_name=True)

