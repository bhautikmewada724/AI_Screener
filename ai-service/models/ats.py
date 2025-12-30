from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


Severity = Literal['critical', 'warning', 'info']
FindingCode = Literal[
  'SCANNED_PDF',
  'TABLES_USED',
  'HEADERS_FOOTERS_USED',
  'NONSTANDARD_HEADINGS',
  'LOW_TEXT_EXTRACT',
  'UNKNOWN_FORMAT',
  'MULTI_COLUMN_LAYOUT',
]


class ATSScanRequest(BaseModel):
  job_id: Optional[str] = Field(default=None, description='Optional job identifier for traceability')
  resume_id: Optional[str] = Field(default=None, description='Optional resume identifier for traceability')

  job_title: str = Field(..., description='Job title', max_length=200)
  job_description: str = Field(..., description='Job description as plain text', max_length=20000)

  file_path: Optional[str] = Field(default=None, description='Backend-accessible path to the uploaded resume file')
  file_name: Optional[str] = Field(default=None, description='Original resume file name')
  user_id: str = Field(..., description='Candidate identifier', max_length=100)
  resume_text: Optional[str] = Field(default=None, description='Optional pre-extracted resume text', max_length=20000)
  candidate_name: Optional[str] = Field(default=None, description='Optional candidate name', max_length=200)


class Finding(BaseModel):
  severity: Severity
  code: FindingCode
  message: str
  whyItMatters: str
  fix: str


class MissingKeyword(BaseModel):
  keyword: str
  importance: int = Field(..., ge=1, le=5)
  jdEvidence: List[str] = Field(default_factory=list)
  suggestedPlacement: Literal['Skills', 'Experience', 'Projects', 'Summary'] = 'Skills'


class KeywordBucket(BaseModel):
  matched: List[str] = Field(default_factory=list)
  missing: List[MissingKeyword] = Field(default_factory=list)


class KeywordAnalysis(BaseModel):
  required: KeywordBucket = Field(default_factory=KeywordBucket)
  preferred: KeywordBucket = Field(default_factory=KeywordBucket)


class SynonymNote(BaseModel):
  resumeTerm: str
  jdTerm: str
  treatedAsMatch: bool = True


class SkillsAnalysis(BaseModel):
  matched: List[str] = Field(default_factory=list)
  missingRequired: List[str] = Field(default_factory=list)
  missingPreferred: List[str] = Field(default_factory=list)
  synonymNotes: List[SynonymNote] = Field(default_factory=list)


class EvidenceGap(BaseModel):
  requirement: str
  status: Literal['missing', 'weak', 'ok']
  exampleFix: str
  whereToAdd: Literal['Experience', 'Projects', 'Summary'] = 'Experience'


class SectionFeedback(BaseModel):
  section: Literal['Summary', 'Skills', 'Experience', 'Projects', 'Education', 'Other']
  severity: Literal['warning', 'info']
  message: str
  fix: str


class RewriteStep(BaseModel):
  priority: Literal['P0', 'P1', 'P2']
  title: str
  action: str
  details: str


class ScoreBlock(BaseModel):
  atsReadabilityScore: int = Field(..., ge=0, le=100)
  keywordMatchScore: int = Field(..., ge=0, le=100)
  evidenceScore: int = Field(..., ge=0, le=100)


class ATSScanResponse(BaseModel):
  schemaVersion: str = '1.0'
  jobId: Optional[str] = None
  resumeId: Optional[str] = None

  overall: ScoreBlock
  formatFindings: List[Finding] = Field(default_factory=list)
  keywordAnalysis: KeywordAnalysis = Field(default_factory=KeywordAnalysis)
  skills: SkillsAnalysis = Field(default_factory=SkillsAnalysis)
  evidenceGaps: List[EvidenceGap] = Field(default_factory=list)
  sectionFeedback: List[SectionFeedback] = Field(default_factory=list)
  rewritePlan: List[RewriteStep] = Field(default_factory=list)
