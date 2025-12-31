from __future__ import annotations

import hashlib
from typing import List

from models.job import JobDescriptionResponse
from models.match import MatchRequest, MatchResponse
from models.rse import JDRequirement
from services.rse_engine import build_requirements, calculate_scores, evaluate_requirements
from services.skill_utils import extract_skills, normalize_skill_list

def _normalize(skills: List[str]) -> List[str]:
  return sorted(set(normalize_skill_list(skills)))


def _build_jd_payload(payload: MatchRequest) -> tuple[str, JobDescriptionResponse]:
  job_text = (payload.job_summary or '').strip()
  if not job_text:
    job_text = ' '.join(payload.job_required_skills or [])
  preferred = []
  constraints = payload.scoring_config.get('constraints') if payload.scoring_config else {}
  if constraints:
    preferred = constraints.get('niceToHaveSkills') or []

  required_skills = normalize_skill_list(payload.job_required_skills or [])
  if not required_skills and job_text:
    required_skills = normalize_skill_list(extract_skills(job_text))

  jd_resp = JobDescriptionResponse(
    required_skills=_normalize(required_skills),
    nice_to_have_skills=_normalize(preferred),
    summary=job_text or 'Job description unavailable.',
    embeddings=[],
    seniority_level=None,
    job_category=None,
    warnings=[]
  )
  return job_text, jd_resp


def _requirement_index(requirements: List[JDRequirement]) -> dict:
  return {req.id: req for req in requirements}


def _hash_text(text: str) -> str:
  return hashlib.sha256((text or '').encode('utf-8', errors='ignore')).hexdigest()


def score_match(payload: MatchRequest) -> MatchResponse:
  job_text, jd_resp = _build_jd_payload(payload)
  requirements = build_requirements(job_text, jd_resp)

  resume_text = (payload.resume_text or payload.resume_summary or '').strip()
  resume_skills = normalize_skill_list(payload.resume_skills or [])
  if resume_text:
    resume_skills = normalize_skill_list(resume_skills + extract_skills(resume_text))
  results = evaluate_requirements(requirements, resume_text)
  breakdown = calculate_scores(requirements, results)

  req_index = _requirement_index(requirements)
  matched = [
    res.requirementText for res in results
    if res.status != 'MISSING' and req_index.get(res.requirementId) and req_index[res.requirementId].type == 'skill'
  ]
  missing = [
    res.requirementText for res in results
    if res.status == 'MISSING' and req_index.get(res.requirementId) and req_index[res.requirementId].isRequired
  ]

  match_score = round(breakdown.jdFitScore / 100, 3)
  notes = (
    f"JD_FIT_SCORE={breakdown.jdFitScore:.1f}. "
    f"Strong:{breakdown.counts.get('STRONG', 0)} "
    f"Weak:{breakdown.counts.get('WEAK', 0)} "
    f"Uncertain:{breakdown.counts.get('UNCERTAIN', 0)} "
    f"Missing:{breakdown.counts.get('MISSING', 0)}."
  )

  explanation = {
    'jdFitScore': breakdown.jdFitScore,
    'requiredScore': breakdown.requiredScore,
    'preferredScore': breakdown.preferredScore,
    'evidenceStrengthScore': breakdown.evidenceStrengthScore,
    'counts': breakdown.counts,
    'requirements': [res.dict() for res in results]
  }

  score_breakdown = {
    'jdFitScore': breakdown.jdFitScore,
    'requiredScore': breakdown.requiredScore,
    'preferredScore': breakdown.preferredScore,
    'evidenceStrengthScore': breakdown.evidenceStrengthScore,
    'totalWeight': breakdown.totalWeight
  }

  trace = None
  if payload.include_trace:
    trace = {
      'resumeTextLength': len(resume_text),
      'jobTextLength': len(job_text),
      'resumeSha': _hash_text(resume_text),
      'jobSha': _hash_text(job_text),
      'requirementCounts': breakdown.counts,
      'requirementsEvaluated': len(results)
    }

  model_metadata = {
    'model_version': 'rse_v1',
    'source': 'rse',
    'satisfaction_mapping': {
      'STRONG': 1.0,
      'WEAK': 0.6,
      'UNCERTAIN': 0.4,
      'MISSING': 0.0
    }
  }

  return MatchResponse(
    match_score=match_score,
    matched_skills=matched,
    missing_critical_skills=missing,
    embedding_similarity=0.0,
    notes=notes,
    explanation=explanation,
    score_breakdown=score_breakdown,
    scoring_config_version=payload.scoring_config_version,
    model_metadata=model_metadata,
    missing_must_have_skills=missing,
    missing_nice_to_have_skills=[],
    trace=trace
  )

