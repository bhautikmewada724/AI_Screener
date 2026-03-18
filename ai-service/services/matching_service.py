from __future__ import annotations

import hashlib
import logging
from typing import Any, Dict, List, Optional

from utils.embeddings_client import cosine_similarity, get_embeddings_client
from models.job import JobDescriptionResponse
from models.match import MatchRequest, MatchResponse
from models.rse import JDRequirement
from services.rse_engine import build_requirements, calculate_scores, evaluate_requirements
from services.skill_utils import categorize_skills, extract_skills, normalize_skill_list

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Scoring weight configuration
# ---------------------------------------------------------------------------
WEIGHT_SKILL = 0.45       # Technical skill overlap
WEIGHT_EXPERIENCE = 0.20  # Experience relevance
WEIGHT_EMBEDDING = 0.20   # Semantic (embedding) similarity
WEIGHT_EDUCATION = 0.10   # Education relevance
WEIGHT_PROJECT = 0.05     # Project relevance


def _normalize(skills: List[str]) -> List[str]:
  return sorted(set(normalize_skill_list(skills)))


def _build_jd_payload(payload: MatchRequest) -> tuple[str, JobDescriptionResponse]:
  """Construct a JD response for downstream requirement building."""
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


def _compute_embedding_similarity(
  resume_text: str,
  resume_summary: str,
  job_text: str,
  job_summary: str
) -> float:
  """Compute semantic cosine similarity between resume and JD embeddings."""
  client = get_embeddings_client()
  try:
    resume_input = f'{resume_summary}\n{resume_text[:4000]}'.strip()
    jd_input = f'{job_summary}\n{job_text[:4000]}'.strip()
    if not resume_input or not jd_input:
      return 0.0
    vectors = client.embed([resume_input, jd_input])
    if len(vectors) < 2:
      return 0.0
    sim = cosine_similarity(vectors[0], vectors[1])
    # Normalize from [-1, 1] to [0, 1]
    return max(0.0, min(1.0, (sim + 1.0) / 2.0))
  except Exception:
    logger.warning('Embedding similarity computation failed')
    return 0.0


def _compute_experience_relevance(
  resume_text: str,
  job_text: str,
  job_required_skills: List[str]
) -> float:
  """Heuristic: how much of the experience section aligns with the JD.

  Looks for skill mentions within experience-like lines (action verbs).
  """
  import re

  exp_patterns = (
    r'\b(led|built|developed|designed|implemented|deployed|managed|created|'
    r'architected|optimized|migrated|maintained|delivered|launched|integrated|'
    r'automated|enhanced|improved|established|engineered|contributed)\b'
  )
  lines = [l.strip() for l in resume_text.splitlines() if l.strip()]
  exp_lines = [l for l in lines if re.search(exp_patterns, l, re.IGNORECASE)]
  if not exp_lines:
    return 0.3  # Minimal score if no experience-style lines found

  exp_text_lower = ' '.join(exp_lines).lower()
  skill_matches = 0
  for skill in job_required_skills:
    if skill.lower() in exp_text_lower:
      skill_matches += 1

  coverage = skill_matches / max(len(job_required_skills), 1)
  # Bonus for having substantial experience content
  content_bonus = min(0.1, len(exp_lines) / 100)
  return min(1.0, coverage + content_bonus)


def _compute_education_relevance(
  resume_text: str,
  job_text: str
) -> float:
  """Heuristic scoring for education alignment.

  Higher scores for STEM degrees when job requires technical skills.
  """
  import re

  resume_lower = resume_text.lower()
  job_lower = job_text.lower()

  score = 0.3  # Base score for having any education

  # Check for degree mentions
  degree_patterns = {
    'masters': 0.3,
    'master': 0.3,
    'm.tech': 0.3,
    'msc': 0.25,
    'm.sc': 0.25,
    'mba': 0.2,
    'phd': 0.35,
    'ph.d': 0.35,
    'bachelor': 0.2,
    'b.tech': 0.2,
    'bsc': 0.15,
    'b.sc': 0.15,
    'bca': 0.15,
    'mca': 0.25,
    'diploma': 0.1,
  }

  max_degree_bonus = 0.0
  for pattern, bonus in degree_patterns.items():
    if pattern in resume_lower:
      max_degree_bonus = max(max_degree_bonus, bonus)

  score += max_degree_bonus

  # Check for STEM field alignment
  stem_fields = [
    'computer science', 'computer engineering', 'software engineering',
    'information technology', 'data science', 'electrical engineering',
    'electronics', 'mathematics', 'statistics', 'artificial intelligence',
    'machine learning', 'mechanical engineering', 'physics',
  ]
  for field in stem_fields:
    if field in resume_lower:
      score += 0.1
      break

  return min(1.0, score)


def _compute_project_relevance(
  resume_text: str,
  job_required_skills: List[str]
) -> float:
  """Score project sections for JD relevance."""
  import re

  # Try to find project section
  lines = resume_text.splitlines()
  in_project = False
  project_lines: List[str] = []
  for line in lines:
    stripped = line.strip()
    lower = stripped.lower()
    if re.match(r'^(projects?|personal projects?|portfolio)\b', lower):
      in_project = True
      continue
    if in_project and re.match(r'^(experience|education|skills|summary)\b', lower):
      break
    if in_project and stripped:
      project_lines.append(stripped)

  if not project_lines:
    return 0.3  # Neutral if no project section

  project_text_lower = ' '.join(project_lines).lower()
  skill_matches = sum(1 for s in job_required_skills if s.lower() in project_text_lower)
  coverage = skill_matches / max(len(job_required_skills), 1)
  # Bonus for having actual projects
  project_bonus = min(0.15, len(project_lines) / 50)
  return min(1.0, coverage + project_bonus + 0.1)


def _build_score_explanation(
  skill_score: float,
  experience_score: float,
  embedding_score: float,
  education_score: float,
  project_score: float,
  matched_skills: List[str],
  missing_skills: List[str],
  missing_nice_to_have: List[str],
  jd_fit_score: float,
  breakdown: Any
) -> Dict[str, Any]:
  """Build a human-readable structured explanation of the score."""

  # Compute overall weighted score
  overall = (
    WEIGHT_SKILL * skill_score * 100 +
    WEIGHT_EXPERIENCE * experience_score * 100 +
    WEIGHT_EMBEDDING * embedding_score * 100 +
    WEIGHT_EDUCATION * education_score * 100 +
    WEIGHT_PROJECT * project_score * 100
  )

  # Generate strength highlights
  strengths: List[str] = []
  if skill_score >= 0.7:
    strengths.append(f'Strong skill overlap ({int(skill_score * 100)}% coverage)')
  if experience_score >= 0.6:
    strengths.append('Relevant experience demonstrates practical application of key skills')
  if embedding_score >= 0.6:
    strengths.append('Resume content is semantically aligned with job requirements')
  if education_score >= 0.6:
    strengths.append('Education background aligns well with role requirements')
  if project_score >= 0.6:
    strengths.append('Project experience demonstrates relevant technical capabilities')

  # Generate improvement areas
  improvements: List[str] = []
  if missing_skills:
    top_missing = missing_skills[:5]
    improvements.append(f'Missing critical skills: {", ".join(top_missing)}')
  if skill_score < 0.5:
    improvements.append('Low skill match — consider upskilling in required technologies')
  if experience_score < 0.4:
    improvements.append('Limited evidence of required skills in experience section')
  if missing_nice_to_have:
    improvements.append(f'Could also benefit from: {", ".join(missing_nice_to_have[:3])}')

  return {
    'overall_score': round(overall, 1),
    'component_scores': {
      'skill_match': {
        'score': round(skill_score * 100, 1),
        'weight': WEIGHT_SKILL,
        'weighted_contribution': round(WEIGHT_SKILL * skill_score * 100, 1),
        'details': f'{len(matched_skills)} skills matched, {len(missing_skills)} missing'
      },
      'experience_relevance': {
        'score': round(experience_score * 100, 1),
        'weight': WEIGHT_EXPERIENCE,
        'weighted_contribution': round(WEIGHT_EXPERIENCE * experience_score * 100, 1),
        'details': 'Based on keyword presence in experience/action-verb lines'
      },
      'semantic_similarity': {
        'score': round(embedding_score * 100, 1),
        'weight': WEIGHT_EMBEDDING,
        'weighted_contribution': round(WEIGHT_EMBEDDING * embedding_score * 100, 1),
        'details': 'Embedding-based semantic similarity between resume and JD'
      },
      'education_relevance': {
        'score': round(education_score * 100, 1),
        'weight': WEIGHT_EDUCATION,
        'weighted_contribution': round(WEIGHT_EDUCATION * education_score * 100, 1),
        'details': 'Degree level and field alignment with job requirements'
      },
      'project_relevance': {
        'score': round(project_score * 100, 1),
        'weight': WEIGHT_PROJECT,
        'weighted_contribution': round(WEIGHT_PROJECT * project_score * 100, 1),
        'details': 'Project section skill overlap with JD requirements'
      }
    },
    'matched_skills': matched_skills,
    'missing_skills': missing_skills,
    'missing_nice_to_have': missing_nice_to_have,
    'strengths': strengths,
    'improvements': improvements,
    'jdFitScore': jd_fit_score,
    'rse_breakdown': {
      'requiredScore': breakdown.requiredScore,
      'preferredScore': breakdown.preferredScore,
      'evidenceStrengthScore': breakdown.evidenceStrengthScore,
      'counts': breakdown.counts,
    }
  }


def _generate_match_notes(
  overall_score: float,
  skill_score: float,
  experience_score: float,
  embedding_score: float,
  matched_skills: List[str],
  missing_skills: List[str],
  breakdown: Any
) -> str:
  """Generate a human-readable match summary."""
  parts = [f'Overall Match: {overall_score:.0f}/100.']

  # Skill assessment
  if skill_score >= 0.8:
    parts.append(f'Excellent skill alignment ({len(matched_skills)} matched).')
  elif skill_score >= 0.5:
    parts.append(f'Good skill coverage ({len(matched_skills)} matched, {len(missing_skills)} gaps).')
  else:
    parts.append(f'Limited skill overlap ({len(missing_skills)} critical gaps).')

  # Experience assessment
  if experience_score >= 0.6:
    parts.append('Experience demonstrates practical use of required skills.')
  elif experience_score >= 0.3:
    parts.append('Some experience alignment detected.')

  # RSE counts
  parts.append(
    f'Evidence: Strong={breakdown.counts.get("STRONG", 0)}, '
    f'Weak={breakdown.counts.get("WEAK", 0)}, '
    f'Missing={breakdown.counts.get("MISSING", 0)}.'
  )

  return ' '.join(parts)


def score_match(payload: MatchRequest) -> MatchResponse:
  """Score a resume against a job description with multi-factor analysis."""
  job_text, jd_resp = _build_jd_payload(payload)
  requirements = build_requirements(job_text, jd_resp)

  resume_text = (payload.resume_text or payload.resume_summary or '').strip()
  resume_summary = (payload.resume_summary or '').strip()
  job_summary = (payload.job_summary or '').strip()

  resume_skills = normalize_skill_list(payload.resume_skills or [])
  if resume_text:
    resume_skills = normalize_skill_list(resume_skills + extract_skills(resume_text))

  # ---- RSE evaluation ----
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
  missing_nice = [
    res.requirementText for res in results
    if res.status == 'MISSING' and req_index.get(res.requirementId) and not req_index[res.requirementId].isRequired
  ]

  # ---- Component scores ----
  jd_required = jd_resp.required_skills or []

  # 1. Skill match score (from RSE)
  skill_score = breakdown.jdFitScore / 100

  # 2. Experience relevance
  experience_score = _compute_experience_relevance(resume_text, job_text, jd_required)

  # 3. Embedding similarity
  embedding_score = _compute_embedding_similarity(resume_text, resume_summary, job_text, job_summary)

  # 4. Education relevance
  education_score = _compute_education_relevance(resume_text, job_text)

  # 5. Project relevance
  project_score = _compute_project_relevance(resume_text, jd_required)

  # ---- Weighted overall score ----
  overall = (
    WEIGHT_SKILL * skill_score +
    WEIGHT_EXPERIENCE * experience_score +
    WEIGHT_EMBEDDING * embedding_score +
    WEIGHT_EDUCATION * education_score +
    WEIGHT_PROJECT * project_score
  )
  overall_100 = overall * 100

  # ---- Build explanation ----
  explanation = _build_score_explanation(
    skill_score=skill_score,
    experience_score=experience_score,
    embedding_score=embedding_score,
    education_score=education_score,
    project_score=project_score,
    matched_skills=matched,
    missing_skills=missing,
    missing_nice_to_have=missing_nice,
    jd_fit_score=breakdown.jdFitScore,
    breakdown=breakdown
  )

  notes = _generate_match_notes(
    overall_score=overall_100,
    skill_score=skill_score,
    experience_score=experience_score,
    embedding_score=embedding_score,
    matched_skills=matched,
    missing_skills=missing,
    breakdown=breakdown
  )

  score_breakdown = {
    'overall_score': round(overall_100, 2),
    'skill_match_score': round(skill_score * 100, 2),
    'experience_match_score': round(experience_score * 100, 2),
    'semantic_similarity_score': round(embedding_score * 100, 2),
    'education_score': round(education_score * 100, 2),
    'project_score': round(project_score * 100, 2),
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
      'requirementsEvaluated': len(results),
      'embeddingSimilarity': round(embedding_score, 4),
      'componentWeights': {
        'skill': WEIGHT_SKILL,
        'experience': WEIGHT_EXPERIENCE,
        'embedding': WEIGHT_EMBEDDING,
        'education': WEIGHT_EDUCATION,
        'project': WEIGHT_PROJECT
      },
      'rawComponentScores': {
        'skill': round(skill_score, 4),
        'experience': round(experience_score, 4),
        'embedding': round(embedding_score, 4),
        'education': round(education_score, 4),
        'project': round(project_score, 4)
      },
      'requirementDetails': [res.dict() for res in results]
    }

  model_metadata = {
    'model_version': 'rse_v2',
    'source': 'rse_multifactor',
    'scoring_weights': {
      'skill': WEIGHT_SKILL,
      'experience': WEIGHT_EXPERIENCE,
      'embedding': WEIGHT_EMBEDDING,
      'education': WEIGHT_EDUCATION,
      'project': WEIGHT_PROJECT
    },
    'satisfaction_mapping': {
      'STRONG': 1.0,
      'WEAK': 0.6,
      'UNCERTAIN': 0.4,
      'MISSING': 0.0
    }
  }

  return MatchResponse(
    match_score=round(overall, 3),
    matched_skills=matched,
    missing_critical_skills=missing,
    embedding_similarity=round(embedding_score, 3),
    notes=notes,
    explanation=explanation,
    score_breakdown=score_breakdown,
    scoring_config_version=payload.scoring_config_version,
    model_metadata=model_metadata,
    missing_must_have_skills=missing,
    missing_nice_to_have_skills=missing_nice,
    trace=trace
  )
