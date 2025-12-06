from models.recommendation import RecommendationRequest
from services.recommendation_service import recommend_jobs


def test_recommend_jobs_prioritizes_skill_overlap():
  payload = RecommendationRequest(
    candidate_id='cand-1',
    skills=['Python', 'FastAPI', 'PostgreSQL', 'AWS'],
    preferred_locations=['remote']
  )

  response = recommend_jobs(payload)

  assert response.ranked_jobs, 'should recommend at least one job'
  assert response.ranked_jobs[0].job_id == 'job-001'
  assert response.ranked_jobs[0].score > response.ranked_jobs[-1].score


def test_recommend_jobs_filters_low_scores():
  payload = RecommendationRequest(
    candidate_id='cand-2',
    skills=['Gardening', 'Cooking'],
    preferred_locations=['miami']
  )

  response = recommend_jobs(payload)

  assert response.ranked_jobs == []

