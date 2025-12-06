from fastapi import APIRouter

from models.recommendation import RecommendationRequest, RecommendationResponse
from services.recommendation_service import recommend_jobs

router = APIRouter(prefix='/ai', tags=['AI - Recommendations'])


@router.post('/recommend', response_model=RecommendationResponse)
def recommend_jobs_route(payload: RecommendationRequest) -> RecommendationResponse:
  """Return skill-aligned job suggestions ranked by overlap and location fit."""
  return recommend_jobs(payload)

