from __future__ import annotations

import os
import re
from datetime import datetime
from typing import List, Optional, Tuple

from docx import Document  # type: ignore
from pypdf import PdfReader  # type: ignore

from core import get_embeddings_client, get_llm_client
from models.resume import EducationItem, ExperienceItem, ResumeParseRequest, ResumeParseResponse
from utils.settings import get_settings

_SKILL_LIBRARY = {
  'python': 'Python',
  'javascript': 'JavaScript',
  'typescript': 'TypeScript',
  'java': 'Java',
  'c++': 'C++',
  'c#': 'C#',
  'go': 'Go',
  'rust': 'Rust',
  'sql': 'SQL',
  'mongodb': 'MongoDB',
  'postgresql': 'PostgreSQL',
  'aws': 'AWS',
  'gcp': 'GCP',
  'azure': 'Azure',
  'docker': 'Docker',
  'kubernetes': 'Kubernetes',
  'terraform': 'Terraform',
  'react': 'React',
  'vue': 'Vue',
  'angular': 'Angular',
  'node.js': 'Node.js',
  'fastapi': 'FastAPI',
  'django': 'Django',
  'flask': 'Flask',
  'graphql': 'GraphQL',
  'rest': 'REST',
  'machine learning': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'nlp': 'NLP',
  'pandas': 'Pandas',
  'numpy': 'NumPy',
  'scikit-learn': 'scikit-learn',
  'pytest': 'pytest',
  'cicd': 'CI/CD',
  'git': 'Git',
  'linux': 'Linux',
  'agile': 'Agile',
  'scrum': 'Scrum',
  'kanban': 'Kanban',
  'communication': 'Communication',
  'leadership': 'Leadership',
  'problem solving': 'Problem Solving',
  'project management': 'Project Management',
  'sql server': 'SQL Server',
  'redis': 'Redis',
  'elasticsearch': 'Elasticsearch'
}

_UNIVERSITY_KEYWORDS = ('university', 'college', 'institute', 'school')


class ResumeParser:
  """Extract structured signals from resumes stored on disk."""

  def __init__(self) -> None:
    self._settings = get_settings()
    self._llm_client = get_llm_client()
    self._embeddings_client = get_embeddings_client()
    self._use_llm = self._settings.ai_provider.lower() != 'mock'

  def parse(self, payload: ResumeParseRequest) -> ResumeParseResponse:
    warnings: List[str] = []
    text = (payload.resume_text or '').strip()

    if not text:
      extracted_text, extract_warning = self._extract_text(payload.file_path)
      text = extracted_text
      if extract_warning:
        warnings.append(extract_warning)

    if not text:
      warnings.append('Resume text could not be extracted; returning fallback response.')
      return ResumeParseResponse(
        summary='Unable to extract resume content.',
        skills=[],
        experience=[],
        education=[],
        embeddings=[],
        warnings=warnings
      )

    summary = self._generate_summary(text, payload.candidate_name)
    skills = self._extract_skills(text)
    experience = self._extract_experience(text)
    education = self._extract_education(text)
    location = self._extract_location(text, payload)
    embeddings = self._build_embeddings(text, summary)

    return ResumeParseResponse(
      summary=summary,
      skills=skills,
      experience=experience,
      education=education,
      location=location,
      embeddings=embeddings,
      warnings=warnings
    )

  def _extract_text(self, file_path: str | None) -> tuple[str, str | None]:
    if not file_path:
      return '', 'No file path provided.'

    if not os.path.exists(file_path):
      return '', f'File not found at {file_path}.'

    try:
      ext = os.path.splitext(file_path)[1].lower()
      if ext in {'.pdf'}:
        reader = PdfReader(file_path)
        pages = [page.extract_text() or '' for page in reader.pages]
        return '\n'.join(pages).strip(), None
      if ext in {'.docx'}:
        document = Document(file_path)
        paragraphs = [para.text for para in document.paragraphs]
        return '\n'.join(paragraphs).strip(), None

      with open(file_path, 'r', encoding='utf-8', errors='ignore') as handle:
        return handle.read().strip(), None
    except Exception as exc:  # noqa: BLE001
      return '', f'Failed to read resume: {exc}'

  def _generate_summary(self, text: str, candidate_name: str | None) -> str:
    head = text.strip().splitlines()
    first_paragraph = ' '.join(head[:5])[:600]

    if not self._use_llm:
      if candidate_name:
        return f"{candidate_name} – {first_paragraph[:250]}".strip()
      return first_paragraph or 'Resume summary unavailable.'

    prompt = (
      "You are parsing a resume. Provide a 2 sentence professional summary highlighting years of "
      "experience, top skills, and industries. Respond with plain text.\n"
      f"Candidate name: {candidate_name or 'Unknown'}\n"
      "Resume:\n"
      f"{text[:4000]}"
    )
    try:
      return self._llm_client.run(prompt)
    except Exception as exc:  # noqa: BLE001
      return f'Summary unavailable (LLM failed: {exc}).'

  def _extract_skills(self, text: str) -> List[str]:
    normalized_text = text.lower()
    detected_keys = {skill for skill in _SKILL_LIBRARY if skill in normalized_text}

    keyword_matches = re.findall(r'\b[A-Za-z+#.]{3,}\b', normalized_text)
    for token in keyword_matches:
      if token in _SKILL_LIBRARY:
        detected_keys.add(token)

    return sorted({_SKILL_LIBRARY[skill] for skill in detected_keys})

  def _extract_experience(self, text: str) -> List[ExperienceItem]:
    experience: List[ExperienceItem] = []
    pattern = re.compile(
      r'(?P<role>[A-Za-z0-9 /&,+-]+)\s+at\s+(?P<company>[A-Za-z0-9 .,&-]+)\s*(?P<duration>\([^)]+\)|[0-9]{4}[^,\n]*)?',
      re.IGNORECASE
    )

    for match in pattern.finditer(text):
      data = match.groupdict()
      start_date, end_date = self._parse_duration(data.get('duration'))
      experience.append(
        ExperienceItem(
          company=data.get('company', '').strip(),
          role=data.get('role', '').strip(),
          duration=(data.get('duration') or '').strip() or None,
          startDate=start_date,
          endDate=end_date
        )
      )
      if len(experience) >= 5:
        break

    return experience

  def _extract_education(self, text: str) -> List[EducationItem]:
    education: List[EducationItem] = []
    for line in text.splitlines():
      lower = line.lower()
      if any(keyword in lower for keyword in _UNIVERSITY_KEYWORDS):
        year_match = re.search(r'(19|20)\d{2}', line)
        education.append(
          EducationItem(
            institution=line.strip(),
            degree=None,
            graduation_year=int(year_match.group()) if year_match else None
          )
        )
      if len(education) >= 3:
        break
    return education

  def _build_embeddings(self, text: str, summary: str) -> List[float]:
    try:
      vectors = self._embeddings_client.embed([f'{summary}\n{text[:4000]}'])
      return vectors[0] if vectors else []
    except Exception:  # noqa: BLE001
      return []

  def _extract_location(self, text: str, payload: ResumeParseRequest) -> Optional[str]:
    candidates: List[str] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    candidates.extend(lines[:8])
    if payload.resume_text:
      candidates.extend(payload.resume_text.splitlines()[:8])

    for line in candidates:
      lower = line.lower()
      if 'remote' in lower:
        return 'Remote'
      if 'location:' in lower:
        possible = line.split(':', 1)[1].strip()
        if possible:
          return possible
      match = re.search(r'[A-Z][a-z]+(?: [A-Z][a-z]+)?,\s*[A-Z]{2}', line)
      if match:
        return match.group()
    return None

  def _parse_duration(self, duration: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not duration:
      return None, None
    duration = duration.strip('() ')
    range_match = re.search(r'(?P<start>[^-–]+)[-–](?P<end>.+)', duration)
    if not range_match:
      return None, None

    start_token = range_match.group('start').strip()
    end_token = range_match.group('end').strip()

    return self._parse_date_token(start_token), self._parse_date_token(end_token)

  def _parse_date_token(self, token: str) -> Optional[str]:
    token_lower = token.lower()
    if token_lower in {'present', 'current', 'now'}:
      return datetime.utcnow().date().isoformat()

    month_map = {
      'jan': '01',
      'feb': '02',
      'mar': '03',
      'apr': '04',
      'may': '05',
      'jun': '06',
      'jul': '07',
      'aug': '08',
      'sep': '09',
      'sept': '09',
      'oct': '10',
      'nov': '11',
      'dec': '12'
    }

    month_year = re.match(r'(?:([A-Za-z]{3,9})\s+)?(\d{4})', token)
    if month_year:
      month = month_year.group(1)
      year = month_year.group(2)
      if month:
        month_key = month[:3].lower()
        month_num = month_map.get(month_key, '01')
      else:
        month_num = '01'
      return f'{year}-{month_num}-01'

    year_only = re.match(r'\d{4}', token)
    if year_only:
      return f'{token[:4]}-01-01'
    return None


def parse_resume(payload: ResumeParseRequest) -> ResumeParseResponse:
  """Module-level helper used by FastAPI routes."""
  parser = ResumeParser()
  return parser.parse(payload)

