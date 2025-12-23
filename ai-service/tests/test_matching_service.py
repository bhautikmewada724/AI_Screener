from models.match import MatchRequest
from services.matching_service import score_match
from utils import embeddings_client


def test_score_match_high_overlap():
  payload = MatchRequest(
    resume_skills=['Python', 'FastAPI', 'PostgreSQL', 'AWS'],
    job_required_skills=['Python', 'FastAPI', 'PostgreSQL'],
    resume_summary='Built FastAPI services on AWS with PostgreSQL storage.',
    job_summary='Looking for Python backend developer with FastAPI experience.'
  )

  response = score_match(payload)

  assert response.match_score > 0.7
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


def test_score_match_includes_component_explanations():
  payload = MatchRequest(
    resume_skills=['Python', 'Docker'],
    job_required_skills=['Python', 'Docker', 'Kubernetes'],
    resume_summary='7 years of experience building distributed systems, remote from Berlin.',
    job_summary='Senior DevOps role (5 years) in Berlin or remote, must know Kubernetes.'
  )

  response = score_match(payload)

  assert 'components' in response.explanation
  assert response.explanation['components']['experience']['years'] >= 7
  assert response.explanation['components']['location']['match']
  assert response.embedding_similarity >= 0


def test_score_match_handles_embedding_failures(monkeypatch):
  class FailingClient(embeddings_client.EmbeddingsClient):
    def embed(self, texts):  # noqa: ARG002
      raise RuntimeError('boom')

  monkeypatch.setattr(embeddings_client, 'get_embeddings_client', lambda: FailingClient())

  payload = MatchRequest(
    resume_skills=['Python'],
    job_required_skills=['Python'],
    resume_summary='',
    job_summary=''
  )

  response = score_match(payload)

  assert response.embedding_similarity == 0
  assert response.match_score >= 0  # still returns a response without raising


def test_score_match_returns_trace_when_requested():
  payload = MatchRequest(
    resume_skills=['Python', 'FastAPI'],
    job_required_skills=['Python', 'FastAPI', 'PostgreSQL'],
    resume_summary='Python dev with FastAPI experience. Email me at test@example.com. Phone: +1 555-123-4567.',
    job_summary='Backend role needing Python and FastAPI.',
    include_trace=True
  )

  response = score_match(payload)

  assert response.trace is not None
  assert response.trace['extraction']['resumeTextLength'] > 0
  assert '<REDACTED_EMAIL>' in response.trace['extraction']['textPreview']
  assert '<REDACTED_PHONE>' in response.trace['extraction']['textPreview']
  assert response.trace['skills']['requiredSkillsMatchedCount'] >= 2


def test_score_match_trace_flags_empty_text():
  payload = MatchRequest(
    resume_skills=[],
    job_required_skills=['Go'],
    resume_summary='',
    job_summary='',
    include_trace=True
  )

  response = score_match(payload)

  assert 'EMPTY_TEXT' in response.trace['extraction']['extractionWarnings']
  assert response.trace['extraction']['resumeTextLength'] == 0


def test_score_match_alias_normalization_and_trace_counts():
  payload = MatchRequest(
    resume_skills=['node js', 'expressjs', 'MongoDB', 'fast api', 'AWS', 'ci cd'],
    job_required_skills=['Node.js', 'Express', 'MongoDB', 'FastAPI', 'AWS', 'CI/CD'],
    resume_summary='Built Node.js + Express services on AWS with CI/CD pipelines and MongoDB.',
    job_summary='Looking for Node.js, Express, MongoDB, FastAPI, AWS, and CI/CD experience.',
    include_trace=True
  )

  response = score_match(payload)

  assert response.trace is not None
  assert response.trace['skills']['requiredSkillsMatchedCount'] == 6
  assert set(response.matched_skills) == {'Node.js', 'Express', 'MongoDB', 'FastAPI', 'AWS', 'CI/CD'}


def test_score_match_uses_resume_text_and_counts_required_skills():
  resume_text = 'Extensive Nodejs and Express.js work with MongoDB, AWS cloud, FastAPI services, and CICD pipelines.'
  payload = MatchRequest(
    resume_skills=['Nodejs', 'Express.js', 'MongoDB', 'FastAPI', 'AWS', 'CICD'],
    job_required_skills=['Node.js', 'Express', 'MongoDB', 'FastAPI', 'AWS', 'CI/CD'],
    resume_text=resume_text,
    resume_summary='Short summary',
    job_summary='Need Node.js, Express, MongoDB, FastAPI, AWS, CI/CD',
    include_trace=True
  )

  response = score_match(payload)

  assert response.trace is not None
  assert response.trace['extraction']['resumeTextLength'] == len(resume_text)
  assert response.trace['skills']['requiredSkillsMatchedCount'] == 6


def test_rest_apis_matches_rest_and_rbac_from_text():
  resume_text = 'Built secure REST API platform with role-based access control and JWT auth.'
  payload = MatchRequest(
    resume_skills=['REST', 'JWT'],
    job_required_skills=['REST APIs', 'RBAC', 'JWT'],
    resume_text=resume_text,
    job_summary='Need REST APIs, RBAC, JWT',
    include_trace=True
  )

  response = score_match(payload)

  assert response.trace is not None
  assert response.trace['skills']['requiredSkillsMatchedCount'] == 3
  assert 'RBAC' in response.trace['skills']['matchedFromText']
  assert 'REST' in response.trace['skills']['matchedFromSkills']

