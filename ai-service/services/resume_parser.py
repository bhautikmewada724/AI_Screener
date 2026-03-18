from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime
from time import perf_counter
from typing import Any, Dict, List, Optional, Tuple, Sequence

from docx import Document  # type: ignore
from pypdf import PdfReader  # type: ignore

from utils.embeddings_client import get_embeddings_client
from utils.llm_client import get_llm_client
from models.resume import (
  EducationItem,
  ExperienceItem,
  ResumeParseDebug,
  ResumeParseRequest,
  ResumeParseResponse
)
from services.parser_constants import (
  LOG_EXCERPT_MAX_CHARS,
  RAW_SECTION_MAX_CHARS,
  RAW_TEXT_MAX_CHARS,
  WARN_EMBEDDINGS_FAILED,
  WARN_EXTRACTION_FAILED,
  WARN_PARSER_FALLBACK_USED,
  WARN_SECTION_NONE_FOUND,
  WARN_SECTION_OVERLAP_SUSPECTED,
  WARN_SKILLS_FROM_NON_SKILLS_SECTION,
  WARN_TEXT_EMPTY,
  WARN_TEXT_TOO_SHORT
)
from services.skill_utils import extract_skills, normalize_skill_list
from utils.settings import get_settings
from utils.observability import ensure_request_id, truncate_text

logger = logging.getLogger(__name__)

_UNIVERSITY_KEYWORDS = ('university', 'college', 'institute', 'school')
_CONTACT_PATTERNS = (
  r'\b\+?\d{7,}\b',
  r'@',
  r'\blinked(in)?\b',
  r'\bgithub\b',
  r'https?://',
  r'\bwww\.',
  r'\.com\b',
  r'\.io\b',
  r'\.net\b',
  r'\.org\b'
)

_MIN_TEXT_LEN = 80


class ResumeParser:
  """Extract structured signals from resumes stored on disk."""

  def __init__(self) -> None:
    self._settings = get_settings()
    self._llm_client = get_llm_client()
    self._embeddings_client = get_embeddings_client()
    provider = self._settings.ai_provider.lower().strip()
    self._use_llm = provider != 'mock' and bool(self._settings.openai_api_key)

  def parse(
    self,
    payload: ResumeParseRequest,
    *,
    request_id: str | None = None,
    debug: bool = False
  ) -> ResumeParseResponse:
    req_id = ensure_request_id(request_id)
    debug_enabled = bool(debug)
    timings: Dict[str, float] = {}
    warnings: List[str] = []
    total_start = perf_counter()

    text = (payload.resume_text or '').strip()
    file_type = self._guess_file_type(payload.file_name or payload.file_path)
    extraction_method = 'provided_text'
    extract_start = perf_counter()
    if not text:
      extracted_text, extract_warning, extract_meta = self._extract_text(payload.file_path)
      timings['extract'] = (perf_counter() - extract_start) * 1000
      text = extracted_text
      extraction_method = extract_meta.get('extraction_method', extraction_method)
      file_type = extract_meta.get('file_type', file_type)
      if extract_warning:
        warnings.extend([WARN_EXTRACTION_FAILED, extract_warning])
    else:
      timings['extract'] = (perf_counter() - extract_start) * 1000

    extracted_lines = len(text.splitlines()) if text else 0

    if not text:
      warnings.append(WARN_TEXT_EMPTY)
      timings['total'] = int((perf_counter() - total_start) * 1000)
      timings_ms = self._coerce_timings(timings)
      debug_payload = self._build_debug_payload(debug_enabled, req_id, text, {}, warnings, timings_ms, {})
      response = ResumeParseResponse(
        summary='Unable to extract resume content.',
        skills=[],
        unverified_skills=[],
        experience=[],
        education=[],
        embeddings=[],
        warnings=self._dedupe_warnings(warnings),
        request_id=req_id,
        debug=debug_payload
      )
      self._log_parse_event(
        req_id,
        {
          'fileType': file_type,
          'extractionMethodUsed': extraction_method,
          'extractedTextChars': 0,
          'extractedTextLines': 0,
          'sectionNamesDetected': [],
          'sectionLineCounts': {},
          'parsedCounts': {'skills': 0, 'experienceItems': 0, 'educationItems': 0, 'projectItems': 0},
          'warnings': response.warnings,
          'timingsMs': timings_ms
        }
      )
      return response

    if len(text) < _MIN_TEXT_LEN:
      warnings.append(WARN_TEXT_TOO_SHORT)

    section_start = perf_counter()
    sanitized_text = self._strip_contact_lines(text)
    sections = self._split_sections(sanitized_text)
    timings['section'] = (perf_counter() - section_start) * 1000
    if not sections:
      warnings.append(WARN_SECTION_NONE_FOUND)

    section_meta = {name: {'line_count': len(content.splitlines())} for name, content in sections.items()}
    section_names = list(section_meta.keys())

    parse_start = perf_counter()
    structured = None
    if self._use_llm:
      try:
        structured = self._extract_structured_with_llm(text, sections)
      except Exception as exc:  # noqa: BLE001
        warnings.append(WARN_PARSER_FALLBACK_USED)
        logger.warning('LLM resume parsing failed: %s', exc)

    summary = structured.get('summary') if structured else None
    if not summary:
      summary = self._generate_summary(text, payload.candidate_name)

    skills: List[str] = []
    unverified_skills: List[str] = []
    skills_source = None
    if structured:
      skills, unverified_struct = self._normalize_skills(structured.get('skills', []))
      skills_source = 'structured'
      unverified_skills.extend(unverified_struct)
    if not skills:
      skill_text = sections.get('skills') or sections.get('projects') or sanitized_text
      skills_source = 'fallback' if not sections.get('skills') else 'section_skills'
      skills, unverified_extracted = self._extract_skills(skill_text)
      unverified_skills.extend(unverified_extracted)
    if skills_source == 'fallback':
      warnings.append(WARN_SKILLS_FROM_NON_SKILLS_SECTION)

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
      education_text = sections.get('education') if sections else None
      education = self._extract_education(text, section_text=education_text)

    location = structured.get('location') if structured else None
    if not location:
      location = self._extract_location(text, payload)

    embeddings = self._build_embeddings(text, summary or '', warnings)

    deduped_unverified: List[str] = []
    seen_unverified = set()
    skill_keys = {skill.lower() for skill in skills if skill}
    for token in unverified_skills:
      key = (token or '').strip().lower()
      if not key or key in seen_unverified or key in skill_keys:
        continue
      seen_unverified.add(key)
      deduped_unverified.append(token.strip())

    timings['parse'] = (perf_counter() - parse_start) * 1000
    timings['total'] = (perf_counter() - total_start) * 1000
    timings_ms = self._coerce_timings(timings)
    deduped_warnings = self._dedupe_warnings(warnings)
    parsed_counts = {
      'skills': len(skills),
      'experienceItems': len(experience),
      'educationItems': len(education),
      'projectItems': len(sections.get('projects', '').splitlines()) if sections else 0
    }

    debug_payload = self._build_debug_payload(
      debug_enabled,
      req_id,
      text,
      sections,
      deduped_warnings,
      timings_ms,
      section_meta
    )

    self._log_parse_event(
      req_id,
      {
        'fileType': file_type,
        'extractionMethodUsed': extraction_method,
        'extractedTextChars': len(text),
        'extractedTextLines': extracted_lines,
        'sectionNamesDetected': section_names,
        'sectionLineCounts': {k: v['line_count'] for k, v in section_meta.items()},
        'parsedCounts': parsed_counts,
        'warnings': deduped_warnings,
        'timingsMs': timings_ms,
        'debugExcerpt': truncate_text(text, LOG_EXCERPT_MAX_CHARS) if debug_enabled else None
      }
    )

    return ResumeParseResponse(
      summary=summary,
      skills=skills,
      unverified_skills=deduped_unverified,
      experience=experience,
      education=education,
      location=location,
      embeddings=embeddings,
      warnings=deduped_warnings,
      request_id=req_id,
      debug=debug_payload
    )

  def _extract_text(self, file_path: str | None) -> tuple[str, str | None, dict[str, str]]:
    meta = {'file_type': self._guess_file_type(file_path), 'extraction_method': 'unknown'}
    if not file_path:
      meta['extraction_method'] = 'missing_file'
      return '', 'No file path provided.', meta

    if not os.path.exists(file_path):
      meta['extraction_method'] = 'missing_file'
      return '', f'File not found at {file_path}.', meta

    try:
      ext = os.path.splitext(file_path)[1].lower()
      meta['file_type'] = self._guess_file_type(file_path)
      if ext in {'.pdf'}:
        meta['extraction_method'] = 'pypdf'
        reader = PdfReader(file_path)
        pages = [page.extract_text() or '' for page in reader.pages]
        return '\n'.join(pages).strip(), None, meta
      if ext in {'.doc', '.docx'}:
        meta['extraction_method'] = 'python-docx'
        document = Document(file_path)
        paragraphs = [para.text for para in document.paragraphs]
        return '\n'.join(paragraphs).strip(), None, meta

      meta['extraction_method'] = 'plaintext'
      with open(file_path, 'r', encoding='utf-8', errors='ignore') as handle:
        return handle.read().strip(), None, meta
    except Exception as exc:  # noqa: BLE001
      meta['extraction_method'] = 'error'
      return '', f'Failed to read resume: {exc}', meta

  def _guess_file_type(self, file_name_or_path: Optional[str]) -> str:
    if not file_name_or_path:
      return 'unknown'
    ext = os.path.splitext(file_name_or_path)[1].lower()
    if ext in {'.pdf'}:
      return 'pdf'
    if ext in {'.doc', '.docx'}:
      return 'docx'
    if ext in {'.txt'}:
      return 'text'
    return ext.lstrip('.') or 'unknown'

  def _split_sections(self, text: str) -> dict[str, str]:
    """Robust section splitter that handles inconsistent resume formatting.

    Handles: ALL-CAPS headings, decorated headings (=== / ---), numbered
    headings, trailing colons/dashes, and a broad set of heading synonyms.
    """
    sections = {
      'summary': [],
      'experience': [],
      'education': [],
      'skills': [],
      'projects': [],
      'certifications': [],
      'achievements': [],
      'other': []
    }
    header_map = {
      'experience': (
        'experience',
        'work experience',
        'professional experience',
        'work history',
        'employment',
        'employment history',
        'career',
        'career history',
        'internship',
        'internships',
        'relevant experience',
        'professional background',
        'industry experience',
        'job history',
        'positions held'
      ),
      'education': (
        'education',
        'academics',
        'academic background',
        'educational background',
        'education history',
        'qualifications',
        'academic qualifications',
        'educational qualifications',
        'academic details',
        'coursework',
        'relevant coursework'
      ),
      'skills': (
        'skills',
        'technical skills',
        'tech stack',
        'technologies',
        'tools',
        'tools and technologies',
        'core competencies',
        'competencies',
        'areas of expertise',
        'technical proficiency',
        'proficiencies',
        'programming skills',
        'languages and tools',
        'technical expertise',
        'skills and tools',
        'key skills',
        'skill set'
      ),
      'projects': (
        'project',
        'projects',
        'project experience',
        'portfolio',
        'personal projects',
        'academic projects',
        'key projects',
        'notable projects',
        'side projects'
      ),
      'summary': (
        'summary',
        'professional summary',
        'profile',
        'about',
        'about me',
        'objective',
        'career objective',
        'professional objective',
        'personal statement',
        'executive summary',
        'introduction',
        'overview'
      ),
      'certifications': (
        'certifications',
        'certificates',
        'licenses',
        'professional certifications',
        'training',
        'courses',
        'online courses'
      ),
      'achievements': (
        'achievements',
        'accomplishments',
        'awards',
        'honors',
        'publications',
        'research',
        'volunteering',
        'volunteer experience',
        'extracurricular',
        'extracurricular activities',
        'interests',
        'hobbies',
        'activities',
        'leadership'
      )
    }
    current = 'other'
    prev_line_was_decoration = False

    for line in text.splitlines():
      raw = line.strip()
      if not raw:
        continue

      # Detect decoration lines (=== or ---) that precede/follow headings
      if re.fullmatch(r'[=\-_~]{3,}', raw):
        prev_line_was_decoration = True
        continue

      # Normalize: strip trailing colons, dashes, decoration chars
      normalized = re.sub(r'[:\-–—=_~]+$', '', raw).strip()
      # Handle ALL-CAPS  and numbered headings like "1. EXPERIENCE"
      normalized = re.sub(r'^\d+[.)\s]+', '', normalized).strip()
      lower = normalized.lower()

      is_heading = self._looks_like_heading(lower) or prev_line_was_decoration
      prev_line_was_decoration = False

      if is_heading:
        matched = False
        for section, aliases in header_map.items():
          if any(re.match(rf'^{re.escape(alias)}\b', lower) for alias in aliases):
            current = section
            matched = True
            break
        if matched:
          continue
      sections[current].append(raw)
    return {k: '\n'.join(v).strip() for k, v in sections.items() if v}

  def _strip_contact_lines(self, text: str) -> str:
    """Remove obvious contact lines before skill extraction."""
    cleaned: List[str] = []
    for line in text.splitlines():
      raw = line.strip()
      if not raw:
        continue
      if self._contains_contact(raw):
        continue
      cleaned.append(raw)
    return '\n'.join(cleaned)

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

  def _extract_skills(self, text: str) -> Tuple[List[str], List[str]]:
    try:
      validated, unverified = extract_skills(text, return_unverified=True)
    except TypeError:
      validated = extract_skills(text)
      unverified = []
    validated = normalize_skill_list(validated)
    return validated, unverified

  def _normalize_skills(self, skills: List[str]) -> Tuple[List[str], List[str]]:
    try:
      return normalize_skill_list(skills, return_unverified=True)
    except TypeError:
      normalized = normalize_skill_list(skills)
      return normalized, []

  def _extract_bullets(self, lines: Sequence[str], start: int) -> List[str]:
    """Collect consecutive bullet-point lines starting from `start`."""
    bullets: List[str] = []
    i = start
    while i < len(lines):
      line = lines[i].strip()
      if not self._is_bullet_line(line):
        break
      cleaned = self._strip_bullet(line)
      if cleaned:
        bullets.append(cleaned)
      i += 1
    return bullets

  def _extract_experience(self, text: str, limit: int = 5) -> List[ExperienceItem]:
    """Extract experience entries with bullet points as descriptions."""
    experience: List[ExperienceItem] = []
    lines = [line.strip() for line in text.splitlines() if line.strip()]

    i = 0
    while i < len(lines) and len(experience) < limit:
      line = lines[i].strip()
      if self._contains_contact(line) or self._is_section_header(line):
        i += 1
        continue
      if self._is_bullet_line(line):
        # Attach bullets to last experience entry if exists
        if experience:
          bullets = self._extract_bullets(lines, i)
          existing_desc = experience[-1].description or ''
          new_desc = '\n'.join(f'• {b}' for b in bullets)
          experience[-1].description = f'{existing_desc}\n{new_desc}'.strip() if existing_desc else new_desc
          i += len(bullets)
        else:
          self._append_bullet_duration(experience, line)
          i += 1
        continue

      parsed = self._parse_experience_line(line)
      if parsed:
        # Look ahead for bullet points
        bullets = self._extract_bullets(lines, i + 1)
        if bullets:
          parsed.description = '\n'.join(f'• {b}' for b in bullets)
        experience.append(parsed)
        i += 1 + len(bullets)
        continue

      if i + 1 < len(lines):
        next_line = lines[i + 1].strip()
        if not self._is_bullet_line(next_line) and not self._is_section_header(next_line) and not self._contains_contact(next_line):
          parsed_pair = self._parse_experience_pair(line, next_line)
          if parsed_pair:
            # Look ahead for bullet points after the pair
            bullets = self._extract_bullets(lines, i + 2)
            if bullets:
              parsed_pair.description = '\n'.join(f'• {b}' for b in bullets)
            experience.append(parsed_pair)
            i += 2 + len(bullets)
            continue
      i += 1

    return experience[:limit]

  def _extract_education(self, text: str, section_text: Optional[str] = None) -> List[EducationItem]:
    education: List[EducationItem] = []
    source_text = section_text or text
    lines = [l.strip() for l in source_text.splitlines() if l.strip()]
    cgpa_patterns = [r'cgpa[:\s]*([\d\.]+)', r'gpa[:\s]*([\d\.]+)', r'grade[:\s]*([\d\.]+)']
    degree_patterns = (
      r'(b\.?\s?tech|bachelor[s]?\s+of\s+technology|bachelor[s]?\s+of\s+engineering|b\.e\.?|be\b|bca\b|bsc|b\.sc\.?)',
      r'(m\.?\s?tech|master[s]?\s+of\s+technology|m\.e\.?|me\b|mca\b|msc\b|m\.sc\.?|ms\b|mba\b)',
      r'(diploma|hsc|ssc)'
    )

    for idx, line in enumerate(lines):
      if self._contains_contact(line) or self._is_section_header(line):
        continue
      lower = line.lower()
      in_section = bool(section_text)
      institution_candidate = False
      if any(keyword in lower for keyword in _UNIVERSITY_KEYWORDS):
        institution_candidate = True
      elif in_section and not self._looks_like_degree(line) and not re.fullmatch(r'(19|20)\d{2}', line):
        institution_candidate = True
      if not institution_candidate:
        continue

      institution = line.strip()
      degree = None
      grad_year = None
      cgpa_value = None

      lookahead = lines[idx: idx + 4]
      combined = ' '.join(lookahead)

      degree_match = None
      for pattern in degree_patterns:
        degree_match = re.search(pattern + r'[^,\n]*', combined, re.IGNORECASE)
        if degree_match:
          break
      if degree_match:
        degree = degree_match.group(0).strip().replace('  ', ' ')

      years = re.findall(r'(?:19|20)\d{2}', combined)
      if years:
        year_candidates = [int(year) for year in years]
        grad_year = self._pick_latest_year(year_candidates)

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

  def _build_embeddings(self, text: str, summary: str, warnings: Optional[List[str]] = None) -> List[float]:
    try:
      vectors = self._embeddings_client.embed([f'{summary}\n{text[:4000]}'])
      return vectors[0] if vectors else []
    except Exception:  # noqa: BLE001
      if warnings is not None:
        warnings.append(WARN_EMBEDDINGS_FAILED)
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
    duration = duration.strip().strip('() ')
    range_match = re.search(
      r'(?P<start>[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4})\s*(?:-|–|—|to)\s*'
      r'(?P<end>present|current|now|[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4})',
      duration,
      re.IGNORECASE
    )
    if not range_match:
      return None, None

    start_token = range_match.group('start').strip()
    end_token = range_match.group('end').strip()

    return self._parse_date_token(start_token), self._parse_date_token(end_token)

  def _parse_date_token(self, token: str) -> Optional[str]:
    token_lower = token.strip().lower()
    if not token_lower:
      return None
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

    mm_yyyy = re.match(r'^(0?[1-9]|1[0-2])[/-](\d{4})$', token_lower)
    if mm_yyyy:
      month = mm_yyyy.group(1).zfill(2)
      year = mm_yyyy.group(2)
      return f'{year}-{month}-01'

    month_year = re.match(r'^([A-Za-z]{3,9})\s+(\d{4})$', token.strip())
    if month_year:
      month_key = month_year.group(1)[:3].lower()
      month_num = month_map.get(month_key, '01')
      year = month_year.group(2)
      return f'{year}-{month_num}-01'

    year_only = re.match(r'^(19|20)\d{2}$', token_lower)
    if year_only:
      return f'{token_lower[:4]}-01-01'
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
    candidates: List[str] = []
    if '```' in sanitized:
      fenced = sanitized.split('```', 1)[1]
      fenced = fenced.split('```', 1)[0]
      fenced = fenced.strip().lstrip('json').strip()
      candidates.append(fenced)
    candidates.append(sanitized)

    for candidate in candidates:
      try:
        data = json.loads(candidate)
      except json.JSONDecodeError:
        continue
      if not isinstance(data, dict):
        raise ValueError('LLM response must be a JSON object.')
      return data

    brace_start = sanitized.find('{')
    brace_end = sanitized.rfind('}')
    if brace_start != -1 and brace_end != -1 and brace_end > brace_start:
      snippet = sanitized[brace_start: brace_end + 1]
      try:
        data = json.loads(snippet)
      except json.JSONDecodeError:
        logger.warning('LLM response was not valid JSON, falling back to heuristics.')
        raise
      if not isinstance(data, dict):
        raise ValueError('LLM response must be a JSON object.')
      return data

    logger.warning('LLM response was not valid JSON, falling back to heuristics.')
    raise json.JSONDecodeError('Invalid JSON', sanitized, 0)

  def _coerce_experience_entries(self, entries: Any) -> List[ExperienceItem]:
    normalized: List[ExperienceItem] = []
    if not isinstance(entries, list):
      return normalized

    for entry in entries[:5]:
      if not isinstance(entry, dict):
        continue
      company = (entry.get('company') or '').strip()
      role = (entry.get('role') or '').strip()
      if not company or not role:
        continue
      if self._contains_contact(company) or self._contains_contact(role):
        continue
      duration = (entry.get('duration') or '').strip() or None
      start_date = self._normalize_date(entry.get('startDate'))
      end_date = self._normalize_date(entry.get('endDate'))
      if duration and (not start_date or not end_date):
        parsed_start, parsed_end = self._parse_duration(duration)
        start_date = start_date or parsed_start
        end_date = end_date or parsed_end
      experience = ExperienceItem(
        company=company,
        role=role,
        duration=duration,
        startDate=start_date,
        endDate=end_date
      )
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

      institution = (entry.get('institution') or '').strip()
      if not institution or self._contains_contact(institution):
        continue
      education = EducationItem(
        institution=institution,
        degree=degree,
        graduation_year=int_year
      )
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

  def _coerce_timings(self, timings: Dict[str, float]) -> Dict[str, int]:
    return {key: int(value) for key, value in timings.items()}

  def _dedupe_warnings(self, warnings: List[str]) -> List[str]:
    seen = set()
    deduped = []
    for warning in warnings:
      if warning in seen:
        continue
      seen.add(warning)
      deduped.append(warning)
    return deduped

  def _build_debug_payload(
    self,
    debug_enabled: bool,
    request_id: str,
    text: str,
    sections: Dict[str, str],
    warnings: List[str],
    timings: Dict[str, int],
    section_meta: Dict[str, Dict[str, int]]
  ) -> Optional[ResumeParseDebug]:
    if not debug_enabled:
      return None
    raw_sections = {
      name: truncate_text(value, RAW_SECTION_MAX_CHARS)
      for name, value in sections.items()
    }
    return ResumeParseDebug(
      request_id=request_id,
      raw_text=truncate_text(text, RAW_TEXT_MAX_CHARS),
      raw_sections=raw_sections,
      section_meta=section_meta,
      parser_warnings=warnings,
      timings_ms=timings
    )

  def _log_parse_event(self, request_id: str, payload: Dict[str, Any]) -> None:
    try:
      logger.info('resume_parse', extra={'request_id': request_id, 'payload': payload})
    except Exception:  # noqa: BLE001
      logger.debug('resume_parse logging failed for request %s', request_id)

  def _looks_like_heading(self, line: str) -> bool:
    """Detect heading-like lines including ALL CAPS, short phrases, decorated text."""
    words = line.split()
    if len(words) > 6 or len(line) > 70:
      return False
    # Short lines (<=5 words, <=60 chars) are heading candidates
    if len(words) <= 5 and len(line) <= 60:
      return True
    # ALL CAPS lines are likely headings
    if line.upper() == line and len(line) >= 3:
      return True
    # Title-case lines with few words
    if line.istitle() and len(words) <= 4:
      return True
    return False

  def _is_section_header(self, line: str) -> bool:
    lower = re.sub(r'[:\-–—]+$', '', line.strip().lower())
    if not self._looks_like_heading(lower):
      return False
    return bool(
      re.match(r'^(experience|work experience|professional experience|work history|employment|employment history|career|career history|internships?)\b', lower)
      or re.match(r'^(education|academics|academic background|educational background|education history|qualifications)\b', lower)
      or re.match(r'^(skills?|technical skills|tech stack|technologies|tools|certifications)\b', lower)
      or re.match(r'^(projects?|project experience|portfolio)\b', lower)
      or re.match(r'^(summary|professional summary|profile|about|objective|career objective)\b', lower)
    )

  def _is_bullet_line(self, line: str) -> bool:
    return bool(re.match(r'^\s*[-*•◦]', line))

  def _strip_bullet(self, line: str) -> str:
    return re.sub(r'^\s*[-*•◦]\s*', '', line).strip()

  def _append_bullet_duration(self, entries: List[ExperienceItem], line: str) -> None:
    if not entries:
      return
    cleaned = self._strip_bullet(line)
    if not cleaned:
      return
    current = entries[-1].duration or ''
    if current and self._looks_like_date_range(current):
      return
    parts = [p.strip() for p in current.split(';') if p.strip()] if current else []
    if len(parts) >= 3:
      return
    parts.append(cleaned)
    entries[-1].duration = '; '.join(parts)

  def _looks_like_date_range(self, text: str) -> bool:
    return bool(re.search(
      r'([A-Za-z]{3,9}\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4})\s*(?:-|–|—|to)\s*'
      r'(present|current|now|[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4})',
      text,
      re.IGNORECASE
    ))

  def _looks_like_role(self, text: str) -> bool:
    return bool(re.search(
      r'(engineer|developer|manager|analyst|consultant|intern|lead|director|architect|designer|scientist|product|data|qa|tester|administrator|assistant|specialist|associate|coordinator|officer|principal)',
      text,
      re.IGNORECASE
    ))

  def _looks_like_company(self, text: str) -> bool:
    return bool(re.search(r'(inc|ltd|llc|corp|co\.|company|technologies|systems|labs|solutions|group)\b', text, re.IGNORECASE))

  def _assign_role_company(self, left: str, right: str) -> Tuple[str, str]:
    left_role = self._looks_like_role(left)
    right_role = self._looks_like_role(right)
    left_company = self._looks_like_company(left)
    right_company = self._looks_like_company(right)
    if left_role and (right_company or not right_role):
      return left, right
    if right_role and (left_company or not left_role):
      return right, left
    return left, right

  def _extract_duration_from_line(self, line: str) -> Tuple[Optional[str], Optional[str], Optional[str], str]:
    match = re.search(
      r'(?P<duration>[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4})\s*(?:-|–|—|to)\s*'
      r'(?P<end>present|current|now|[A-Za-z]{3,9}\s+\d{4}|\d{1,2}[/-]\d{4}|\d{4})',
      line,
      re.IGNORECASE
    )
    if not match:
      return None, None, None, line
    duration = match.group(0).strip()
    cleaned = (line[:match.start()] + line[match.end():]).strip(' |,-')
    start_date, end_date = self._parse_duration(duration)
    return duration, start_date, end_date, cleaned

  def _parse_experience_line(self, line: str) -> Optional[ExperienceItem]:
    if not line or self._is_bullet_line(line):
      return None
    duration, start_date, end_date, cleaned = self._extract_duration_from_line(line)

    parts = [p.strip() for p in re.split(r'\s*\|\s*', cleaned) if p.strip()]
    if len(parts) >= 2:
      role, company = self._assign_role_company(parts[0], parts[1])
      if role and company:
        return ExperienceItem(
          company=company,
          role=role,
          duration=duration,
          startDate=start_date,
          endDate=end_date
        )

    at_match = re.match(r'(.+?)\s+at\s+(.+)$', cleaned, re.IGNORECASE)
    if at_match:
      role = at_match.group(1).strip()
      company = at_match.group(2).strip()
      if role and company:
        return ExperienceItem(
          company=company,
          role=role,
          duration=duration,
          startDate=start_date,
          endDate=end_date
        )

    comma_parts = [p.strip() for p in re.split(r'\s*,\s*', cleaned) if p.strip()]
    if len(comma_parts) >= 2:
      role, company = self._assign_role_company(comma_parts[0], comma_parts[1])
      if role and company:
        return ExperienceItem(
          company=company,
          role=role,
          duration=duration,
          startDate=start_date,
          endDate=end_date
        )

    dash_parts = [p.strip() for p in re.split(r'\s+[-–—]\s+', cleaned) if p.strip()]
    if len(dash_parts) >= 2:
      role, company = self._assign_role_company(dash_parts[0], dash_parts[1])
      if role and company:
        return ExperienceItem(
          company=company,
          role=role,
          duration=duration,
          startDate=start_date,
          endDate=end_date
        )
    return None

  def _parse_experience_pair(self, first: str, second: str) -> Optional[ExperienceItem]:
    duration, start_date, end_date, cleaned = self._extract_duration_from_line(first)
    if duration:
      role, company = self._assign_role_company(cleaned, second)
    else:
      role, company = self._assign_role_company(first, second)
    if not role or not company:
      return None
    return ExperienceItem(
      company=company,
      role=role,
      duration=duration,
      startDate=start_date,
      endDate=end_date
    )

  def _looks_like_degree(self, line: str) -> bool:
    return bool(re.search(
      r'(b\.?\s?tech|bachelor|b\.e\.?|be\b|bca\b|bsc|b\.sc\.?|m\.?\s?tech|master|m\.e\.?|me\b|mca\b|msc\b|m\.sc\.?|ms\b|mba\b|diploma|hsc|ssc)',
      line,
      re.IGNORECASE
    ))

  def _pick_latest_year(self, years: List[int]) -> Optional[int]:
    if not years:
      return None
    now = datetime.utcnow().year + 1
    filtered = [year for year in years if 1950 <= year <= now]
    return max(filtered) if filtered else None


def parse_resume(payload: ResumeParseRequest) -> ResumeParseResponse:
  """Module-level helper used by FastAPI routes."""
  parser = ResumeParser()
  return parser.parse(payload)

