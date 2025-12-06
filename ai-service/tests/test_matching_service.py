from models.match import MatchRequest
from services.matching_service import score_match


def test_score_match_high_overlap():
  payload = MatchRequest(
    resume_skills=['Python', 'FastAPI', 'PostgreSQL', 'AWS'],
    job_required_skills=['Python', 'FastAPI', 'PostgreSQL'],
    resume_summary='Built FastAPI services on AWS with PostgreSQL storage.',
    job_summary='Looking for Python backend developer with FastAPI experience.'
  )

  response = score_match(payload)

  assert response.match_score > 0.8
  assert set(response.matched_skills) == {'Python', 'FastAPI', 'PostgreSQL'}
  assert not response.missing_critical_skills


def test_score_match_penalizes_missing_skills():
  payload = MatchRequest(
    resume_skills=['Excel', 'Communication'],
    job_required_skills=['Python', 'FastAPI', 'PostgreSQL'],
    resume_summary='Entry-level analyst experienced with Excel.',
    job_summary='Needs backend engineer with modern Python stack.'
  )

  response = score_match(payload)

  assert response.match_score < 0.4
  assert set(response.missing_critical_skills) == {'Python', 'FastAPI', 'PostgreSQL'}
  assert 'Missing' in response.notes

