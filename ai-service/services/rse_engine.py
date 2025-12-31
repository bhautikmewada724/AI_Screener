from __future__ import annotations

import hashlib
import logging
import re
from typing import Iterable, List, Tuple

from models.job import JobDescriptionResponse
from models.resume import ResumeParseResponse
from models.rse import JDRequirement, JDScoreBreakdown, RequirementResult
from services.skill_utils import normalize_skill_list, normalize_token

logger = logging.getLogger(__name__)

_SATISFACTION_MAP = {
  'STRONG': 1.0,
  'WEAK': 0.6,
  'UNCERTAIN': 0.4,
  'MISSING': 0.0
}


def _stable_id(kind: str, terms: Iterable[str]) -> str:
  seed = f'{kind}::{"|".join(sorted({t.lower() for t in terms if t}))}'
  return hashlib.sha1(seed.encode('utf-8')).hexdigest()[:12]


def _detect_explicit_years(text: str) -> List[str]:
  matches = re.findall(r'(\d{1,2})\s*(\+?\s*)?(?:years|yrs)', text, flags=re.IGNORECASE)
  requirements = []
  for years, _ in matches:
    years_clean = years.strip()
    if not years_clean:
      continue
    requirements.append(f'{years_clean} years experience')
  return requirements


def _detect_location(text: str) -> List[str]:
  matches = []
  loc_hint = re.findall(r'(?:location|based in|onsite in)\s*[:\-]?\s*([A-Za-z ,]+)', text, flags=re.IGNORECASE)
  for loc in loc_hint:
    cleaned = loc.strip()
    if cleaned:
      matches.append(cleaned)
  if re.search(r'\bremote\b', text, re.IGNORECASE):
    matches.append('Remote')
  return matches


def build_requirements(
  job_text: str,
  parsed_jd: JobDescriptionResponse
) -> List[JDRequirement]:
  """Derive explicit requirements from parsed JD output + raw text."""
  requirements: List[JDRequirement] = []
  normalized_required = normalize_skill_list(parsed_jd.required_skills or [])
  normalized_preferred = normalize_skill_list(parsed_jd.nice_to_have_skills or [])

  for skill in normalized_required:
    normalized_terms = normalize_skill_list([skill])
    requirements.append(
      JDRequirement(
        id=_stable_id('skill', normalized_terms),
        type='skill',
        rawText=skill,
        normalizedTerms=normalized_terms,
        weight=1.0,
        isRequired=True,
        explicitlyStated=True,
        evidenceRule='Mentioned with context in Experience/Projects.'
      )
    )

  for skill in normalized_preferred:
    normalized_terms = normalize_skill_list([skill])
    requirements.append(
      JDRequirement(
        id=_stable_id('skill_pref', normalized_terms),
        type='skill',
        rawText=skill,
        normalizedTerms=normalized_terms,
        weight=0.6,
        isRequired=False,
        explicitlyStated=True,
        evidenceRule='Mentioned anywhere; stronger if evidenced in Experience/Projects.'
      )
    )

  years_requirements = _detect_explicit_years(job_text)
  for req in years_requirements:
    terms = normalize_token(req).split()
    requirements.append(
      JDRequirement(
        id=_stable_id('experience', terms),
        type='experience',
        rawText=req,
        normalizedTerms=terms,
        weight=0.8,
        isRequired=True,
        explicitlyStated=True,
        evidenceRule='Evidence of duration in Experience section.'
      )
    )

  locations = _detect_location(job_text)
  for loc in locations:
    terms = normalize_token(loc).split()
    requirements.append(
      JDRequirement(
        id=_stable_id('location', terms),
        type='location',
        rawText=loc,
        normalizedTerms=terms,
        weight=0.8,
        isRequired=True,
        explicitlyStated=True,
        evidenceRule='Resume location matches JD location.'
      )
    )

  return requirements


def _split_sections(resume_text: str) -> dict:
  sections = {
    'summary': [],
    'experience': [],
    'projects': [],
    'skills': [],
    'education': [],
    'other': []
  }
  current = 'other'
  for line in resume_text.splitlines():
    raw = line.strip()
    if not raw:
      continue
    lower = raw.lower()
    if re.match(r'^(experience|work experience)\b', lower):
      current = 'experience'
      continue
    if re.match(r'^(projects?)\b', lower):
      current = 'projects'
      continue
    if re.match(r'^skills?\b', lower):
      current = 'skills'
      continue
    if re.match(r'^(education|academics)\b', lower):
      current = 'education'
      continue
    if re.match(r'^(summary|profile|about)\b', lower):
      current = 'summary'
      continue
    sections[current].append(raw)
  return {k: '\n'.join(v).strip() for k, v in sections.items() if v}


def canonicalize_term(text: str) -> str:
  """Universal canonicalization for tech phrases (punctuation, js suffix, plurals)."""
  cleaned = normalize_token(text or '')
  cleaned = re.sub(r'[.,/()\-]+', ' ', cleaned)
  cleaned = cleaned.replace('restful', 'rest')
  cleaned = re.sub(r'\bapis\b', 'api', cleaned)
  cleaned = re.sub(r'\bapi\b', 'api', cleaned)
  cleaned = re.sub(r'\bnode\s+js\b', 'nodejs', cleaned)
  cleaned = re.sub(r'\bexpress\s+js\b', 'express', cleaned)
  cleaned = cleaned.replace('expressjs', 'express')
  cleaned = cleaned.replace('nodejsjs', 'nodejs')
  cleaned = re.sub(r'\bjson\s+web\s+tokens?\b', 'jwt', cleaned)
  cleaned = re.sub(r'\bjwt\s+token(s)?\b', 'jwt', cleaned)
  cleaned = re.sub(r'\s+', ' ', cleaned).strip()
  return cleaned


def canonicalize_terms_list(terms: List[str]) -> List[str]:
  normalized = []
  for term in terms:
    if not term:
      continue
    normalized.append(canonicalize_term(term))
  return [t for t in normalized if t]


def _find_evidence_snippets(resume_text: str, terms: List[str], max_len: int = 120) -> Tuple[List[str], str | None]:
  lower_text = resume_text.lower()
  snippets: List[str] = []
  for term in terms:
    if not term:
      continue
    pos = lower_text.find(term.lower())
    if pos == -1:
      continue
    start = max(pos - 40, 0)
    end = min(pos + len(term) + 40, len(resume_text))
    snippet = resume_text[start:end].strip()
    if len(snippet) > max_len:
      snippet = snippet[:max_len]
    snippets.append(snippet)
  # Deduplicate while preserving order
  seen = set()
  unique = []
  for s in snippets:
    if s in seen:
      continue
    seen.add(s)
    unique.append(s)
  return unique[:3], 'Experience' if any(snippets) else None


def evaluate_requirements(
  requirements: List[JDRequirement],
  resume_text: str,
  resume_parse: ResumeParseResponse | None = None
) -> List[RequirementResult]:
  canonical_full = canonicalize_term(resume_text or '')
  sections = _split_sections(resume_text or '')
  experience_text = canonicalize_term(sections.get('experience', ''))
  projects_text = canonicalize_term(sections.get('projects', ''))
  skills_text = canonicalize_term(sections.get('skills', ''))
  summary_text = canonicalize_term(sections.get('summary', ''))
  full_text = canonical_full

  results: List[RequirementResult] = []
  for req in requirements:
    terms = canonicalize_terms_list(req.normalizedTerms or [req.rawText])
    terms = [t for t in terms if t]
    strong_hit = any(term in experience_text or term in projects_text for term in terms)
    weak_hit = any(term in skills_text or term in summary_text for term in terms)
    any_hit = any(term in full_text for term in terms)

    if strong_hit:
      status = 'STRONG'
      confidence = 0.9
    elif weak_hit:
      status = 'WEAK'
      confidence = 0.65
    elif any_hit:
      status = 'UNCERTAIN'
      confidence = 0.5
    else:
      status = 'MISSING'
      confidence = 0.25

    snippets, section = _find_evidence_snippets(resume_text or '', terms)
    snippet_text = canonicalize_term(' '.join(snippets))
    if (status == 'MISSING' or status == 'UNCERTAIN') and any(term in snippet_text for term in terms):
      status = 'WEAK'
      confidence = max(confidence, 0.4)

    satisfaction = _SATISFACTION_MAP[status]

    results.append(
      RequirementResult(
        requirementId=req.id,
        requirementText=req.rawText,
        normalizedTerms=terms,
        status=status,
        satisfactionScore=satisfaction,
        confidence=confidence,
        evidenceSnippets=snippets,
        section=section
      )
    )
  return results


def calculate_scores(requirements: List[JDRequirement], results: List[RequirementResult]) -> JDScoreBreakdown:
  weight_by_id = {req.id: req.weight for req in requirements}
  required_flags = {req.id: req.isRequired for req in requirements}
  total_weight = sum(weight_by_id.values()) or 1.0

  weighted_sum = 0.0
  required_sum = 0.0
  required_weight = 0.0
  preferred_sum = 0.0
  preferred_weight = 0.0
  strong_count = 0
  weak_count = 0
  uncertain_count = 0
  missing_count = 0

  for res in results:
    w = weight_by_id.get(res.requirementId, 0.0)
    weighted_sum += w * res.satisfactionScore
    if required_flags.get(res.requirementId, False):
      required_sum += w * res.satisfactionScore
      required_weight += w
    else:
      preferred_sum += w * res.satisfactionScore
      preferred_weight += w
    if res.status == 'STRONG':
      strong_count += 1
    elif res.status == 'WEAK':
      weak_count += 1
    elif res.status == 'UNCERTAIN':
      uncertain_count += 1
    else:
      missing_count += 1

  jd_fit_score = (weighted_sum / total_weight) * 100
  required_score = (required_sum / (required_weight or 1.0)) * 100
  preferred_score = (preferred_sum / (preferred_weight or 1.0)) * 100
  evidence_strength_score = (
    strong_count / max((strong_count + weak_count + uncertain_count), 1)
  ) * 100

  counts = {
    'STRONG': strong_count,
    'WEAK': weak_count,
    'UNCERTAIN': uncertain_count,
    'MISSING': missing_count
  }

  return JDScoreBreakdown(
    jdFitScore=round(jd_fit_score, 2),
    requiredScore=round(required_score, 2),
    preferredScore=round(preferred_score, 2),
    evidenceStrengthScore=round(evidence_strength_score, 2),
    totalWeight=round(total_weight, 3),
    counts=counts
  )

