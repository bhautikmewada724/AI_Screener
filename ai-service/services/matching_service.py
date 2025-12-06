from __future__ import annotations

from typing import List

from core import get_embeddings_client
from core.embeddings_client import cosine_similarity
from models.match import MatchRequest, MatchResponse


def _normalize(skills: List[str]) -> List[str]:
  return sorted({skill.strip() for skill in skills if skill})


def _skill_overlap(resume_skills: List[str], job_skills: List[str]) -> tuple[float, List[str], List[str]]:
  resume_set = {skill.lower() for skill in resume_skills}
  job_set = {skill.lower() for skill in job_skills}

  matched = [skill for skill in job_skills if skill.lower() in resume_set]
  missing = [skill for skill in job_skills if skill.lower() not in resume_set]

  coverage = len(matched) / (len(job_skills) or 1)
  return coverage, matched, missing


def _embedding_similarity(payload: MatchRequest) -> float:
  resume_text = payload.resume_summary or ' '.join(payload.resume_skills)
  job_text = payload.job_summary or ' '.join(payload.job_required_skills)

  resume_text = resume_text.strip()
  job_text = job_text.strip()

  if not resume_text or not job_text:
    return 0.0

  embeddings_client = get_embeddings_client()
  vectors = embeddings_client.embed([resume_text, job_text])
  if len(vectors) != 2:
    return 0.0

  similarity = cosine_similarity(vectors[0], vectors[1])
  return max(0.0, min(1.0, (similarity + 1) / 2))  # map [-1,1] -> [0,1]


def _clamp01(value: float) -> float:
  return max(0.0, min(1.0, value))


def score_match(payload: MatchRequest) -> MatchResponse:
  resume_skills = _normalize(payload.resume_skills)
  job_skills = _normalize(payload.job_required_skills)

  skill_score, matched_skills, missing_skills = _skill_overlap(resume_skills, job_skills)
  embedding_score = _embedding_similarity(payload)
  missing_penalty = 0.15 if missing_skills else 0.0

  match_score = (
    0.65 * skill_score +
    0.30 * embedding_score +
    0.05 * (1.0 - missing_penalty)
  ) - missing_penalty
  match_score = _clamp01(match_score)

  notes = (
    f"{len(matched_skills)} of {len(job_skills) or 1} required skills matched. "
    f"Embedding similarity {embedding_score:.2f}. "
    f"{'Missing: ' + ', '.join(missing_skills) if missing_skills else 'All critical skills present.'}"
  )

  explanation = {
    'skill_score': round(skill_score, 3),
    'embedding_similarity': round(embedding_score, 3),
    'weights': {'skills': 0.65, 'embeddings': 0.30, 'context': 0.05},
    'missing_skills': missing_skills,
  }

  return MatchResponse(
    match_score=round(match_score, 3),
    matched_skills=matched_skills,
    missing_critical_skills=missing_skills,
    embedding_similarity=round(embedding_score, 3),
    notes=notes,
    explanation=explanation
  )

