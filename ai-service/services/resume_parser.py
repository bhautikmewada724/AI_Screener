from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from typing import Any, List, Optional, Tuple

from docx import Document  # type: ignore
from pypdf import PdfReader  # type: ignore

from utils.embeddings_client import get_embeddings_client
from utils.llm_client import get_llm_client
from models.resume import EducationItem, ExperienceItem, ResumeParseRequest, ResumeParseResponse
from services.skill_utils import extract_skills, normalize_skill_list
from utils.settings import get_settings

logger = logging.getLogger(__name__)

_UNIVERSITY_KEYWORDS = ('university', 'college', 'institute', 'school')
_CONTACT_PATTERNS = (
  r'\b\+?\d{7,}\b',
  r'@',
  r'\blinked(in)?\b',
  r'\bgithub\b'
)


class ResumeParser:
  """Extract structured signals from resumes stored on disk."""

  def __init__(self) -> None:
    self._settings = get_settings()
    self._llm_client = get_llm_client()
    self._embeddings_client = get_embeddings_client()
    provider = self._settings.ai_provider.lower().strip()
    self._use_llm = provider != 'mock' and bool(self._settings.openai_api_key)

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

    sections = self._split_sections(text)
    structured = None
    if self._use_llm:
      try:
        structured = self._extract_structured_with_llm(text, sections)
      except Exception as exc:  # noqa: BLE001
        warnings.append('LLM parsing unavailable, falling back to heuristics.')
        logger.warning('LLM resume parsing failed: %s', exc)

    summary = structured.get('summary') if structured else None
    if not summary:
      summary = self._generate_summary(text, payload.candidate_name)

    skills = normalize_skill_list(structured.get('skills', [])) if structured else []
    if not skills:
      skills = self._extract_skills(text)

    experience = []
    if structured:
      experience = self._coerce_experience_entries(structured.get('experience', []))
    if not experience:
      exp_text = sections.get('experience') if sections else text
      experience = self._extract_experience(exp_text or text)

    education = []
    if structured:
      education = self._coerce_education_entries(structured.get('education', []))
    if not education:
      education = self._extract_education(text)

    location = structured.get('location') if structured else None
    if not location:
      location = self._extract_location(text, payload)

    embeddings = self._build_embeddings(text, summary or '')

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

  def _split_sections(self, text: str) -> dict[str, str]:
    """Lightweight section splitter to reduce cross-contamination."""
    sections = {
      'summary': [],
      'experience': [],
      'education': [],
      'skills': [],
      'projects': [],
      'other': []
    }
    current = 'other'
    for line in text.splitlines():
      raw = line.strip()
      if not raw:
        continue
      lower = raw.lower()
      if re.match(r'^(experience|work experience)\b', lower):
        current = 'experience'
        continue
      if re.match(r'^(education|academics)\b', lower):
        current = 'education'
        continue
      if re.match(r'^skills?\b', lower):
        current = 'skills'
        continue
      if re.match(r'^(projects?)\b', lower):
        current = 'projects'
        continue
      if re.match(r'^(summary|profile|about)\b', lower):
        current = 'summary'
        continue
      sections[current].append(raw)
    return {k: '\n'.join(v).strip() for k, v in sections.items() if v}

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
    return normalize_skill_list(extract_skills(text))

  def _extract_experience(self, text: str, limit: int = 5) -> List[ExperienceItem]:
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
      if len(experience) >= limit:
        break

    # Fallback: two-line pairing (company then role)
    if len(experience) < limit:
      lines = [line.strip('•* ').strip() for line in text.splitlines() if line.strip()]
      for i in range(len(lines) - 1):
        company_line = lines[i]
        role_line = lines[i + 1]
        if company_line.lower() in {'experience', 'education', 'skills'} or role_line.lower() in {'experience', 'education', 'skills'}:
          continue
        if role_line.startswith(('-', '*', '•', '◦')):
          continue
        if not re.search(r'[A-Za-z]', company_line) or not re.search(r'[A-Za-z]', role_line):
          continue
        experience.append(
          ExperienceItem(
            company=company_line,
            role=role_line,
            duration=None,
            startDate=None,
            endDate=None,
            description=None
          )
        )
        if len(experience) >= limit:
          break

    return experience[:limit]

  def _extract_education(self, text: str) -> List[EducationItem]:
    education: List[EducationItem] = []
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    cgpa_patterns = [r'cgpa[:\s]*([\d\.]+)', r'gpa[:\s]*([\d\.]+)', r'grade[:\s]*([\d\.]+)']

    for idx, line in enumerate(lines):
      lower = line.lower()
      if not any(keyword in lower for keyword in _UNIVERSITY_KEYWORDS):
        continue

      institution = line.strip()
      degree = None
      grad_year = None
      cgpa_value = None

      # Look ahead a couple of lines for degree/cgpa info
      lookahead = lines[idx: idx + 4]
      combined = ' '.join(lookahead)

      degree_match = re.search(
        r'(b\.?\s?tech|bachelor[s]?\s+of\s+technology|bachelor[s]?\s+of\s+engineering|b\.e\.?|bsc|b\.sc\.?)'
        r'[^,\n]*?(computer|cs|information|software|technology|engineering)?[A-Za-z ]*',
        combined,
        re.IGNORECASE
      )
      if degree_match:
        degree = degree_match.group(0).strip().replace('  ', ' ')

      year_match = re.search(r'(19|20)\d{2}', combined)
      if year_match:
        grad_year = int(year_match.group())

      for pattern in cgpa_patterns:
        m = re.search(pattern, combined, re.IGNORECASE)
        if m:
          cgpa_value = m.group(1)
          break

      if degree and cgpa_value:
        try:
          cgpa_val = float(str(cgpa_value).strip())
          degree = f"{degree} (CGPA: {cgpa_val})"
        except Exception:
          degree = f"{degree} (CGPA: {cgpa_value})"

      education.append(
        EducationItem(
          institution=institution,
          degree=degree,
          graduation_year=grad_year
        )
      )
      if len(education) >= 5:
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

  def _extract_structured_with_llm(self, text: str, sections: dict[str, str]) -> dict[str, Any]:
    experience_text = sections.get('experience') or text
    education_text = sections.get('education') or text
    skills_text = sections.get('skills') or ''
    summary_text = sections.get('summary') or ''

    prompt = (
      "Extract resume details and return strict JSON with keys:\n"
      "{\n"
      '  "summary": string,\n'
      '  "skills": string[],\n'
      '  "experience": [\n'
      '    { "company": string, "role": string, "startDate": string|undefined, "endDate": string|undefined, '
      '      "duration": string|undefined, "location": string|undefined, "bullets": string[]|undefined, "description": string|undefined }\n'
      '  ],\n'
      '  "education": [ { "institution": string, "degree": string|undefined, "graduation_year": number|undefined, '
      '                 "location": string|undefined, "startDate": string|undefined, "endDate": string|undefined, "bullets": string[]|undefined, "cgpa": number|undefined } ],\n'
      '  "location": string|undefined\n'
      "}\n"
      "- Use ISO-8601 dates when possible. Limit experience and education to top 5 entries each.\n"
      "- Do not include contact info (phone, email, links) in experience/education.\n"
      "- Keep bullets from the source when present.\n"
      "- Experience entries must have both company and role; ignore generic sentences without a company.\n"
      "- Prefer the Experience section; only fallback to other text if that section is empty.\n"
      "- Education: include the exact degree name (e.g., 'B.Tech in Computer Science Engineering') and CGPA/GPA if present.\n"
      f"Experience section:\n{experience_text[:4000]}\n\n"
      f"Education section:\n{education_text[:4000]}\n\n"
      f"Skills section:\n{skills_text[:2000]}\n\n"
      f"Summary section:\n{summary_text[:2000]}\n\n"
      "Full resume excerpt for fallback:\n"
      f"{text[:4000]}"
    )
    raw = self._llm_client.run(
      prompt,
      temperature=0.1,
      system_prompt='You convert resumes into concise structured JSON. Return JSON only.'
    )
    return self._parse_json_response(raw)

  def _parse_json_response(self, content: str) -> dict[str, Any]:
    sanitized = content.strip()
    if '```' in sanitized:
      sanitized = sanitized.split('```', 1)[1]
      sanitized = sanitized.split('```', 1)[0]
    sanitized = sanitized.strip()
    try:
      data = json.loads(sanitized)
    except json.JSONDecodeError:
      logger.warning('LLM response was not valid JSON, falling back to heuristics.')
      raise
    if not isinstance(data, dict):
      raise ValueError('LLM response must be a JSON object.')
    return data

  def _coerce_experience_entries(self, entries: Any) -> List[ExperienceItem]:
    normalized: List[ExperienceItem] = []
    if not isinstance(entries, list):
      return normalized

    for entry in entries[:5]:
      if not isinstance(entry, dict):
        continue
      bullets = entry.get('bullets') or []
      if isinstance(bullets, str):
        bullets = [bullets]
      if isinstance(bullets, list):
        bullets = [
          b.strip() for b in bullets
          if isinstance(b, str) and b.strip() and not self._contains_contact(b)
        ]
      experience = ExperienceItem(
        company=(entry.get('company') or '').strip(),
        role=(entry.get('role') or '').strip(),
        duration=(entry.get('duration') or entry.get('description') or '').strip() or None,
        startDate=self._normalize_date(entry.get('startDate')),
        endDate=self._normalize_date(entry.get('endDate')),
        description=(
          (entry.get('description') or '').strip()
          or ('; '.join(bullets) if bullets else None)
        )
      )
      if experience.company or experience.role:
        normalized.append(experience)
    return normalized

  def _coerce_education_entries(self, entries: Any) -> List[EducationItem]:
    normalized: List[EducationItem] = []
    if not isinstance(entries, list):
      return normalized

    for entry in entries[:5]:
      if not isinstance(entry, dict):
        continue
      year = entry.get('graduation_year') or entry.get('graduationYear') or entry.get('year')
      cgpa = entry.get('cgpa') or entry.get('gpa') or entry.get('GPA') or entry.get('grade')
      try:
        int_year = int(year)
      except (TypeError, ValueError):
        int_year = self._extract_year_from_text(entry.get('notes') or '')

      degree = (entry.get('degree') or '').strip() or None
      if degree and cgpa:
        # Append CGPA to degree string for display without schema change
        try:
          cgpa_val = float(str(cgpa).strip())
          degree = f"{degree} (CGPA: {cgpa_val})"
        except Exception:
          degree = f"{degree} (CGPA: {cgpa})"

      education = EducationItem(
        institution=(entry.get('institution') or '').strip(),
        degree=degree,
        graduation_year=int_year
      )
      if education.institution:
        normalized.append(education)
    return normalized

  def _normalize_date(self, value: Any) -> Optional[str]:
    if not value:
      return None
    if isinstance(value, str):
      value = value.strip()
      if not value:
        return None
      try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return parsed.date().isoformat()
      except ValueError:
        return self._parse_date_token(value)
    return None

  def _extract_year_from_text(self, text: str) -> Optional[int]:
    if not text:
      return None
    year_match = re.search(r'(19|20)\d{2}', text)
    if year_match:
      return int(year_match.group())
    return None

  def _contains_contact(self, text: str) -> bool:
    lower = text.lower()
    return any(re.search(pattern, lower) for pattern in _CONTACT_PATTERNS)


def parse_resume(payload: ResumeParseRequest) -> ResumeParseResponse:
  """Module-level helper used by FastAPI routes."""
  parser = ResumeParser()
  return parser.parse(payload)

