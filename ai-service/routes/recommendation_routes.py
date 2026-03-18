import logging

from fastapi import APIRouter, HTTPException, status

from models.recommendation import RecommendationRequest, RecommendationResponse
from services.recommendation_service import recommend_jobs

router = APIRouter(prefix='/ai', tags=['AI - Recommendations'])
logger = logging.getLogger(__name__)


@router.post('/recommend', response_model=RecommendationResponse)
def recommend_jobs_route(payload: RecommendationRequest) -> RecommendationResponse:
  """Return skill-aligned job suggestions ranked by overlap and location fit."""
  try:
    return recommend_jobs(payload)
  except HTTPException:
    raise
  except Exception as exc:  # noqa: BLE001
    logger.exception('recommend failed: %s', exc)
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail={'error': 'recommendation_failed', 'message': 'Recommendation generation failed. Please try again.'}
    ) from exc

