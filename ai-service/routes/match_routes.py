import logging

from fastapi import APIRouter, HTTPException, status

from models.match import MatchRequest, MatchResponse
from services.matching_service import score_match

router = APIRouter(prefix='/ai', tags=['AI - Matching'])
logger = logging.getLogger(__name__)


@router.post('/match', response_model=MatchResponse)
def match_resume_to_job(payload: MatchRequest) -> MatchResponse:
  """Return a scored match that blends skills and embeddings."""
  try:
    return score_match(payload)
  except HTTPException:
    raise
  except Exception as exc:  # noqa: BLE001
    logger.exception('match failed: %s', exc)
    raise HTTPException(
      status_code=status.HTTP_502_BAD_GATEWAY,
      detail={'error': 'match_failed', 'message': 'Matching failed. Please try again.'}
    ) from exc

