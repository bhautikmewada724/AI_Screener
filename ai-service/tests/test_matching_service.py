from models.match import MatchRequest
from services.matching_service import score_match


def test_score_match_strong_for_experienced_candidate():
  payload = MatchRequest(
    resume_skills=['Python', 'FastAPI', 'PostgreSQL', 'AWS'],
    job_required_skills=['Python', 'FastAPI', 'PostgreSQL'],
    resume_text='Experience: Built FastAPI services with PostgreSQL and AWS.\nSkills: Python, FastAPI, PostgreSQL',
    job_summary='Must have: Python, FastAPI, PostgreSQL'
  )

  response = score_match(payload)

  assert response.match_score >= 0.95
  assert set(response.matched_skills) == {'Python', 'FastAPI', 'PostgreSQL'}
  assert response.missing_critical_skills == []


def test_score_match_weak_when_only_skills_section():
  payload = MatchRequest(
    resume_skills=['Python', 'FastAPI'],
    job_required_skills=['Python', 'FastAPI'],
    resume_text='Skills: Python, FastAPI\nSummary: Enthusiastic developer.',
    job_summary='Must have Python and FastAPI'
  )

  response = score_match(payload)

  assert 0.55 <= response.match_score <= 0.7
  assert set(response.matched_skills) == {'Python', 'FastAPI'}


def test_score_match_drops_when_missing_required():
  payload = MatchRequest(
    resume_skills=['Excel'],
    job_required_skills=['Python', 'FastAPI', 'PostgreSQL'],
    resume_text='Skills: Excel',
    job_summary='Must have Python, FastAPI, PostgreSQL'
  )

  response = score_match(payload)

  assert response.match_score < 0.2
  assert set(response.missing_critical_skills) == {'Python', 'FastAPI', 'PostgreSQL'}


def test_score_match_returns_trace_and_requirements():
  payload = MatchRequest(
    resume_skills=['Python', 'FastAPI'],
    job_required_skills=['Python', 'FastAPI', 'PostgreSQL'],
    resume_text='Experience: Developed Python services with FastAPI.',
    job_summary='Must have Python, FastAPI, PostgreSQL',
    include_trace=True,
    scoring_config_version=3
  )

  response = score_match(payload)

  assert response.trace is not None
  assert response.trace['requirementsEvaluated'] == 3
  assert response.explanation['counts']['STRONG'] >= 1
  assert response.scoring_config_version == 3

