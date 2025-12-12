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

